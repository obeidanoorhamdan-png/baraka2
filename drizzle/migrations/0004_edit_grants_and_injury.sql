CREATE TABLE public.edit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  granted_by uuid,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.edit_grants TO authenticated;
GRANT ALL ON public.edit_grants TO service_role;
ALTER TABLE public.edit_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read grants" ON public.edit_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_tier(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_grant_edit(_user_id uuid, _minutes integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _exp timestamptz;
BEGIN
  IF NOT public.can_review(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF _minutes IS NULL OR _minutes < 1 OR _minutes > 43200 THEN RAISE EXCEPTION 'invalid duration'; END IF;
  UPDATE public.edit_grants SET revoked = true WHERE user_id = _user_id AND NOT revoked;
  _exp := now() + make_interval(mins => _minutes);
  INSERT INTO public.edit_grants (user_id, expires_at, granted_by) VALUES (_user_id, _exp, auth.uid());
  PERFORM public.log_admin_action('grant_edit','profile',_user_id::text,NULL,jsonb_build_object('minutes',_minutes));
  RETURN _exp;
END $$;

CREATE OR REPLACE FUNCTION public.admin_revoke_edit(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.edit_grants SET revoked = true WHERE user_id = _user_id AND NOT revoked;
  PERFORM public.log_admin_action('revoke_edit','profile',_user_id::text,NULL,NULL);
  RETURN true;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS injury_location text,
  ADD COLUMN IF NOT EXISTS injury_severity text,
  ADD COLUMN IF NOT EXISTS needs_treatment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS treatment_supplies text;
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS injury_location text,
  ADD COLUMN IF NOT EXISTS injury_severity text,
  ADD COLUMN IF NOT EXISTS needs_treatment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS treatment_supplies text;