
-- 1) Enhanced incomplete accounts: report exactly what is missing
DROP FUNCTION IF EXISTS public.list_incomplete_accounts();
CREATE OR REPLACE FUNCTION public.list_incomplete_accounts()
 RETURNS TABLE(
   user_id uuid, full_name text, national_id text, phone text,
   created_at timestamp with time zone, reason text, application_id uuid,
   member_count integer, family_size integer, status text, missing text[]
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.national_id,
    p.phone,
    p.created_at,
    CASE
      WHEN a.id IS NULL THEN 'no_application'
      WHEN NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.application_id = a.id) THEN 'empty_application'
      ELSE 'incomplete'
    END,
    a.id,
    COALESCE((SELECT count(*)::int FROM public.family_members fm WHERE fm.application_id = a.id), 0),
    a.family_size,
    a.status::text,
    (
      CASE WHEN a.id IS NULL THEN ARRAY['الطلب لم يُنشأ بعد'] ELSE ARRAY[]::text[] END
      || CASE WHEN a.id IS NOT NULL AND COALESCE(NULLIF(trim(a.original_residence), ''), NULL) IS NULL THEN ARRAY['السكن الأصلي'] ELSE ARRAY[]::text[] END
      || CASE WHEN a.id IS NOT NULL AND COALESCE(NULLIF(trim(a.current_camp), ''), NULL) IS NULL THEN ARRAY['المخيم / مكان الإيواء'] ELSE ARRAY[]::text[] END
      || CASE WHEN a.id IS NOT NULL AND COALESCE(NULLIF(trim(a.current_landmark), ''), NULL) IS NULL THEN ARRAY['أقرب معلم حالي'] ELSE ARRAY[]::text[] END
      || CASE WHEN a.id IS NOT NULL AND COALESCE(a.family_size, 0) < 1 THEN ARRAY['عدد الأفراد'] ELSE ARRAY[]::text[] END
      || CASE WHEN a.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.application_id = a.id) THEN ARRAY['أفراد الأسرة'] ELSE ARRAY[]::text[] END
    )
  FROM public.profiles p
  LEFT JOIN public.applications a ON a.user_id = p.id
  WHERE NOT public.has_role(p.id, 'admin')
    AND (
      a.id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.application_id = a.id)
    )
  ORDER BY p.created_at DESC;
END;
$function$;

-- 2) Promote a completed account to the review queue (pending)
CREATE OR REPLACE FUNCTION public.admin_promote_to_review(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _app_id uuid;
  _members int;
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO _app_id FROM public.applications WHERE user_id = _user_id LIMIT 1;
  IF _app_id IS NULL THEN
    RAISE EXCEPTION 'no_application' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO _members FROM public.family_members WHERE application_id = _app_id;
  IF _members = 0 THEN
    RAISE EXCEPTION 'empty_application' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.applications
     SET status = 'pending',
         rejection_reason = NULL,
         reviewed_at = NULL,
         reviewed_by = NULL,
         submitted_at = now(),
         updated_at = now()
   WHERE id = _app_id;

  PERFORM public.log_admin_action('promote_to_review', 'application', _app_id::text, NULL, NULL);
  RETURN true;
END;
$function$;

-- 3) Duplicate detection: the head of family must not be counted as a duplicate of itself.
-- The head is represented by the profile; their own is_head family_member row is excluded.
CREATE OR REPLACE FUNCTION public.find_duplicate_persons()
 RETURNS TABLE(match_kind text, match_value text, occurrences integer, person_names text[], application_ids uuid[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH all_persons AS (
    SELECT p.national_id, p.full_name, p.birth_date, a.id AS application_id
    FROM public.profiles p
    LEFT JOIN public.applications a ON a.user_id = p.id
    WHERE p.national_id IS NOT NULL AND length(p.national_id) >= 5
    UNION ALL
    SELECT fm.national_id, fm.full_name, fm.birth_date, fm.application_id
    FROM public.family_members fm
    WHERE fm.national_id IS NOT NULL AND length(fm.national_id) >= 5
      AND fm.is_head = false  -- head already counted via profile
  ),
  by_nid AS (
    SELECT 'national_id'::text AS match_kind,
           national_id AS match_value,
           count(*)::int AS occurrences,
           array_agg(DISTINCT full_name) AS person_names,
           array_agg(DISTINCT application_id) FILTER (WHERE application_id IS NOT NULL) AS application_ids
    FROM all_persons
    GROUP BY national_id
    HAVING count(*) > 1
  ),
  by_name_dob AS (
    SELECT 'name_birth'::text AS match_kind,
           (full_name || ' • ' || birth_date::text) AS match_value,
           count(*)::int AS occurrences,
           array_agg(DISTINCT full_name) AS person_names,
           array_agg(DISTINCT application_id) FILTER (WHERE application_id IS NOT NULL) AS application_ids
    FROM all_persons
    WHERE birth_date IS NOT NULL
    GROUP BY full_name, birth_date
    HAVING count(*) > 1
  )
  SELECT * FROM by_nid
  UNION ALL
  SELECT * FROM by_name_dob
  ORDER BY occurrences DESC;
END $function$;

-- 4) Occurrences list: skip the head's own is_head member row (shown once as head via profile)
CREATE OR REPLACE FUNCTION public.admin_duplicate_occurrences(_nid text)
 RETURNS TABLE(kind text, person_id uuid, member_id uuid, application_id uuid, full_name text, head_name text, current_camp text, relationship text, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
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
  WHERE fm.national_id = _nid
    AND fm.is_head = false;  -- the head's own row is shown via profile
END $function$;
