CREATE OR REPLACE FUNCTION public.admin_update_head_json(_user_id uuid, _patch jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles p SET
    full_name = COALESCE(NULLIF(_patch->>'full_name',''), p.full_name),
    national_id = COALESCE(NULLIF(_patch->>'national_id',''), p.national_id),
    phone = COALESCE(NULLIF(_patch->>'phone',''), p.phone),
    alt_phone = CASE WHEN _patch ? 'alt_phone' THEN NULLIF(_patch->>'alt_phone','') ELSE p.alt_phone END,
    birth_date = COALESCE((NULLIF(_patch->>'birth_date',''))::date, p.birth_date),
    gender = COALESCE((NULLIF(_patch->>'gender',''))::gender, p.gender),
    marital_status = COALESCE((NULLIF(_patch->>'marital_status',''))::marital_status, p.marital_status),
    chronic_diseases = CASE WHEN _patch ? 'chronic_diseases' THEN NULLIF(_patch->>'chronic_diseases','') ELSE p.chronic_diseases END,
    health_notes = CASE WHEN _patch ? 'health_notes' THEN NULLIF(_patch->>'health_notes','') ELSE p.health_notes END,
    work_status = CASE WHEN _patch ? 'work_status' THEN NULLIF(_patch->>'work_status','') ELSE p.work_status END,
    is_war_injured = CASE WHEN _patch ? 'is_war_injured' THEN (_patch->>'is_war_injured')::boolean ELSE p.is_war_injured END,
    is_special_needs = CASE WHEN _patch ? 'is_special_needs' THEN (_patch->>'is_special_needs')::boolean ELSE p.is_special_needs END,
    updated_at = now()
  WHERE p.id = _user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM public.log_admin_action('edit_head','profile',_user_id::text, _patch->>'full_name', NULL);
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_update_head_json(uuid, jsonb) TO authenticated;