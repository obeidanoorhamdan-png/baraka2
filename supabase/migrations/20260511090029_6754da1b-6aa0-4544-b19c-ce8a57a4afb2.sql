-- Helper functions
CREATE OR REPLACE FUNCTION public.is_admin_tier(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
      AND role IN ('admin','super_admin','reviewer','aid_distributor','viewer')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_review(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','reviewer')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_distribute_aid(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin','aid_distributor')
  )
$$;

-- Admin sessions
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip text, user_agent text, device_label text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON public.admin_sessions(user_id, started_at DESC);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user views own sessions" ON public.admin_sessions
  FOR SELECT USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "user inserts own sessions" ON public.admin_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_admin_tier(auth.uid()));
CREATE POLICY "user updates own sessions" ON public.admin_sessions
  FOR UPDATE USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin deletes sessions" ON public.admin_sessions
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Login attempts
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, national_id text, ip text,
  success boolean NOT NULL DEFAULT false, reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_nid ON public.admin_login_attempts(national_id, attempted_at DESC);
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads attempts" ON public.admin_login_attempts
  FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "anyone inserts attempt" ON public.admin_login_attempts
  FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.is_admin_locked(_nid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.admin_login_attempts
    WHERE national_id = _nid AND success = false
      AND attempted_at > now() - interval '15 minutes'
  ) >= 5;
$$;

-- OTP codes
CREATE TABLE IF NOT EXISTS public.admin_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'login',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_otp_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_fa_enabled boolean NOT NULL DEFAULT false;

-- Auto-promote existing admins to super_admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::app_role FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

-- list_admins includes role
DROP FUNCTION IF EXISTS public.list_admins();
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, full_name text, national_id text, phone text, role text, two_fa_enabled boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (p.id) p.id, p.full_name, p.national_id, p.phone,
    (SELECT ur.role::text FROM public.user_roles ur
       WHERE ur.user_id = p.id
         AND ur.role IN ('super_admin','admin','reviewer','aid_distributor','viewer')
       ORDER BY CASE ur.role
         WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
         WHEN 'reviewer' THEN 3 WHEN 'aid_distributor' THEN 4 ELSE 5
       END LIMIT 1) AS role,
    p.two_fa_enabled, p.created_at
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin','super_admin','reviewer','aid_distributor','viewer'))
  ORDER BY p.id, p.created_at;
END $$;

-- Grant role
CREATE OR REPLACE FUNCTION public.grant_role_by_nid(_nid text, _role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: super admin required' USING ERRCODE = '42501';
  END IF;
  IF _role NOT IN ('admin','super_admin','reviewer','aid_distributor','viewer') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  SELECT id INTO uid FROM public.profiles WHERE national_id = _nid;
  IF uid IS NULL THEN RETURN false; END IF;
  DELETE FROM public.user_roles
   WHERE user_id = uid AND role IN ('admin','super_admin','reviewer','aid_distributor','viewer');
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, _role::app_role) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

-- Revoke any admin-tier role
CREATE OR REPLACE FUNCTION public.revoke_admin(_uid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM public.user_roles WHERE role IN ('admin','super_admin')) <= 1
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'cannot remove last super admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.user_roles
   WHERE user_id = _uid AND role IN ('admin','super_admin','reviewer','aid_distributor','viewer');
  RETURN true;
END $$;

-- Update useAuth.isAdmin compatibility: any admin-tier role should pass
-- (handled in client code by querying is_admin_tier RPC)