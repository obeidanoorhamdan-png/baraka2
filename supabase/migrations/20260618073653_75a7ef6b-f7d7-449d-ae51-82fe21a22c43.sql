-- Returns each occurrence of a national_id across heads (profiles) and family members,
-- so admins can decide which duplicate to remove.
CREATE OR REPLACE FUNCTION public.admin_duplicate_occurrences(_nid text)
RETURNS TABLE(
  kind text,
  person_id uuid,
  member_id uuid,
  application_id uuid,
  full_name text,
  head_name text,
  current_camp text,
  relationship text,
  status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  -- Head-of-family occurrences
  SELECT
    'head'::text,
    p.id,
    NULL::uuid,
    a.id,
    p.full_name,
    p.full_name,
    a.current_camp,
    'rb_alosra'::text,
    a.status::text
  FROM public.profiles p
  LEFT JOIN public.applications a ON a.user_id = p.id
  WHERE p.national_id = _nid

  UNION ALL
  -- Family member occurrences
  SELECT
    'member'::text,
    NULL::uuid,
    fm.id,
    fm.application_id,
    fm.full_name,
    hp.full_name,
    a.current_camp,
    fm.relationship::text,
    a.status::text
  FROM public.family_members fm
  JOIN public.applications a ON a.id = fm.application_id
  LEFT JOIN public.profiles hp ON hp.id = a.user_id
  WHERE fm.national_id = _nid;
END $$;

-- Deletes a duplicated family member and decrements the family size of its application.
CREATE OR REPLACE FUNCTION public.admin_remove_family_member(_member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _app_id uuid;
  _name text;
  _nid text;
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT application_id, full_name, national_id
    INTO _app_id, _name, _nid
  FROM public.family_members WHERE id = _member_id;

  IF _app_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.family_members WHERE id = _member_id;

  -- Decrement the family size, never below 1.
  UPDATE public.applications
     SET family_size = GREATEST(1, COALESCE(family_size, 1) - 1),
         updated_at = now()
   WHERE id = _app_id;

  PERFORM public.log_admin_action(
    'remove_duplicate_member', 'family_member', _member_id::text, _name,
    jsonb_build_object('application_id', _app_id, 'national_id', _nid)
  );
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_duplicate_occurrences(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_family_member(uuid) TO authenticated;