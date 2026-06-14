-- 1) Camp lock toggle on app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS camp_lock_enabled boolean NOT NULL DEFAULT false;

-- 2) Camp roster: national IDs approved to register under a camp.
CREATE TABLE IF NOT EXISTS public.camp_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id text NOT NULL,
  camp text,
  head_name text,
  status text NOT NULL DEFAULT 'approved', -- 'approved' | 'removed'
  note text,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT camp_roster_national_id_key UNIQUE (national_id),
  CONSTRAINT camp_roster_status_chk CHECK (status IN ('approved','removed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.camp_roster TO authenticated;
GRANT ALL ON public.camp_roster TO service_role;

ALTER TABLE public.camp_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage camp roster"
  ON public.camp_roster FOR ALL TO authenticated
  USING (public.is_admin_tier(auth.uid()))
  WITH CHECK (public.is_admin_tier(auth.uid()));

CREATE TRIGGER trg_camp_roster_updated_at
  BEFORE UPDATE ON public.camp_roster
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Security-definer check used during registration (no direct table read needed by anon/users)
CREATE OR REPLACE FUNCTION public.camp_id_allowed(_nid text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked boolean;
BEGIN
  SELECT camp_lock_enabled INTO locked FROM public.app_settings WHERE id = 1;
  -- If lock disabled, everyone is allowed
  IF NOT COALESCE(locked, false) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.camp_roster
    WHERE national_id = _nid AND status = 'approved'
  );
END $$;

-- Check whether an id was explicitly removed from approvals (excluded from forms/excel)
CREATE OR REPLACE FUNCTION public.camp_id_removed(_nid text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.camp_roster WHERE national_id = _nid AND status = 'removed'
  );
$$;

-- 3) Data update requests: ask specific applicants to update their data.
CREATE TABLE IF NOT EXISTS public.data_update_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid,
  target_national_id text,
  application_id uuid,
  requested_by uuid,
  fields text[] NOT NULL DEFAULT '{}',
  message text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_update_requests_status_chk CHECK (status IN ('open','resolved'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_update_requests TO authenticated;
GRANT ALL ON public.data_update_requests TO service_role;

ALTER TABLE public.data_update_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage update requests"
  ON public.data_update_requests FOR ALL TO authenticated
  USING (public.is_admin_tier(auth.uid()))
  WITH CHECK (public.is_admin_tier(auth.uid()));

CREATE POLICY "users see own update requests"
  ON public.data_update_requests FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

CREATE POLICY "users resolve own update requests"
  ON public.data_update_requests FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid())
  WITH CHECK (target_user_id = auth.uid());

CREATE TRIGGER trg_data_update_requests_updated_at
  BEFORE UPDATE ON public.data_update_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();