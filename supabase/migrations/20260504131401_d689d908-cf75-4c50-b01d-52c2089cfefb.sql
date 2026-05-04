CREATE OR REPLACE FUNCTION public.get_random_security_question(_nid text, _exclude_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(question_id uuid, kind text, label text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM public.profiles WHERE national_id = _nid LIMIT 1;
  IF uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH pool AS (
    SELECT fm.id AS qid, 'national_id'::text AS k, fm.full_name AS lbl
    FROM public.family_members fm
    JOIN public.applications a ON a.id = fm.application_id
    WHERE a.user_id = uid AND fm.national_id IS NOT NULL AND length(fm.national_id) = 9
    UNION ALL
    SELECT fm.id, 'birth_date', fm.full_name
    FROM public.family_members fm
    JOIN public.applications a ON a.id = fm.application_id
    WHERE a.user_id = uid AND fm.birth_date IS NOT NULL
    UNION ALL
    SELECT p.id, 'self_birth_date', p.full_name
    FROM public.profiles p
    WHERE p.id = uid AND p.birth_date IS NOT NULL
  )
  SELECT qid, k, lbl FROM pool
  WHERE _exclude_id IS NULL OR qid <> _exclude_id
  ORDER BY random() LIMIT 1;
END; $function$;