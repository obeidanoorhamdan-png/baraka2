CREATE OR REPLACE FUNCTION public.admin_update_head_extra(_user_id uuid, _patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  UPDATE public.profiles p SET
    id_card_url = CASE WHEN _patch ? 'id_card_url' THEN NULLIF(_patch->>'id_card_url','') ELSE p.id_card_url END,
    is_university_student = CASE WHEN _patch ? 'is_university_student' THEN (_patch->>'is_university_student')::boolean ELSE p.is_university_student END,
    university_major = CASE WHEN _patch ? 'university_major' THEN NULLIF(_patch->>'university_major','') ELSE p.university_major END,
    university_name = CASE WHEN _patch ? 'university_name' THEN NULLIF(_patch->>'university_name','') ELSE p.university_name END,
    university_year = CASE WHEN _patch ? 'university_year' THEN NULLIF(_patch->>'university_year','') ELSE p.university_year END,
    updated_at = now()
  WHERE p.id = _user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.log_admin_action('edit_head_extra','profile',_user_id::text, NULL, _patch);
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_head_extra(uuid, jsonb) TO authenticated;