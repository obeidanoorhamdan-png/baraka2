
-- Audit log table to track admin actions (approve/reject/delete/etc.)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_name text,
  action text NOT NULL,                  -- e.g. approve_application, reject_application, delete_incomplete, change_pin, add_admin, remove_admin, distribute_aid
  target_type text,                      -- application | profile | aid | settings | role
  target_id text,                        -- free-text id reference
  target_label text,                     -- human readable label (head name, NID, etc.)
  details jsonb,                         -- arbitrary extra info
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads audit" ON public.admin_audit_log;
CREATE POLICY "admin reads audit" ON public.admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin writes audit" ON public.admin_audit_log;
CREATE POLICY "admin writes audit" ON public.admin_audit_log
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = actor_id);

-- Convenience RPC to log + view admin list
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _target_label text DEFAULT NULL,
  _details jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT full_name INTO uname FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.admin_audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
  VALUES (auth.uid(), uname, _action, _target_type, _target_id, _target_label, _details);
END $$;

-- List all admins (for managers UI)
CREATE OR REPLACE FUNCTION public.list_admins()
RETURNS TABLE(user_id uuid, full_name text, national_id text, phone text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.national_id, p.phone, p.created_at
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'
  ORDER BY p.created_at;
END $$;

-- Promote / demote (admin-only)
CREATE OR REPLACE FUNCTION public.grant_admin_by_nid(_nid text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO uid FROM public.profiles WHERE national_id = _nid;
  IF uid IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_admin(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  -- prevent revoking the last admin
  IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'cannot remove last admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'admin';
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.log_admin_action(text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admins() TO authenticated;
REVOKE ALL ON FUNCTION public.grant_admin_by_nid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_admin_by_nid(text) TO authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_admin(uuid) TO authenticated;
