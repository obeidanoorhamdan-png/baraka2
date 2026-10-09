CREATE OR REPLACE FUNCTION public.admin_update_head_injury(_user_id uuid, _patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles p SET
    injury_report_url = CASE WHEN _patch ? 'injury_report_url' THEN NULLIF(_patch->>'injury_report_url','') ELSE p.injury_report_url END,
    injury_location = CASE WHEN _patch ? 'injury_location' THEN NULLIF(_patch->>'injury_location','') ELSE p.injury_location END,
    injury_severity = CASE WHEN _patch ? 'injury_severity' THEN NULLIF(_patch->>'injury_severity','') ELSE p.injury_severity END,
    needs_treatment = CASE WHEN _patch ? 'needs_treatment' THEN (_patch->>'needs_treatment')::boolean ELSE p.needs_treatment END,
    treatment_supplies = CASE WHEN _patch ? 'treatment_supplies' THEN NULLIF(_patch->>'treatment_supplies','') ELSE p.treatment_supplies END,
    updated_at = now()
  WHERE p.id = _user_id;
  RETURN FOUND;
END $$;