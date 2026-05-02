-- 1) Allow email to be optional in profiles
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- 2) Update handle_new_user to NOT depend on NEW.email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, national_id, full_name, email, phone, alt_phone, birth_date, gender,
    marital_status, marital_status_other, is_war_injured, chronic_diseases, health_notes
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'national_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'email',''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'alt_phone',''),
    COALESCE((NEW.raw_user_meta_data->>'birth_date')::date, CURRENT_DATE),
    COALESCE((NEW.raw_user_meta_data->>'gender')::public.gender, 'male'),
    COALESCE((NEW.raw_user_meta_data->>'marital_status')::public.marital_status, 'single'),
    NULLIF(NEW.raw_user_meta_data->>'marital_status_other',''),
    COALESCE((NEW.raw_user_meta_data->>'is_war_injured')::boolean, false),
    NULLIF(NEW.raw_user_meta_data->>'chronic_diseases',''),
    NULLIF(NEW.raw_user_meta_data->>'health_notes','')
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

-- 3) Update handle_new_admin to grant admin based on national_id meta
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'national_id','') = '000000000' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;

-- Recreate the triggers (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin();

-- 4) Lookup helper: national_id -> user_id (used to map ID to synthetic email for sign-in)
CREATE OR REPLACE FUNCTION public.find_user_id_by_nid(_nid text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.profiles WHERE national_id = _nid LIMIT 1;
$$;

-- 5) Get 2 random security questions about family members
-- Returns: question_id (family_member id), kind ('national_id'|'birth_date'), label (member name)
CREATE OR REPLACE FUNCTION public.get_security_questions(_nid text)
RETURNS TABLE(question_id uuid, kind text, label text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  )
  SELECT qid, k, lbl FROM pool ORDER BY random() LIMIT 2;
END; $$;

-- 6) Verify both answers (each: question_id + kind + value). Returns true if both correct.
CREATE OR REPLACE FUNCTION public.verify_security_answers(
  _nid text,
  _q1 uuid, _k1 text, _v1 text,
  _q2 uuid, _k2 text, _v2 text
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
  ok1 boolean := false;
  ok2 boolean := false;
BEGIN
  SELECT id INTO uid FROM public.profiles WHERE national_id = _nid LIMIT 1;
  IF uid IS NULL THEN RETURN false; END IF;

  IF _k1 = 'national_id' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.family_members fm
      JOIN public.applications a ON a.id = fm.application_id
      WHERE a.user_id = uid AND fm.id = _q1 AND fm.national_id = _v1
    ) INTO ok1;
  ELSIF _k1 = 'birth_date' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.family_members fm
      JOIN public.applications a ON a.id = fm.application_id
      WHERE a.user_id = uid AND fm.id = _q1 AND fm.birth_date::text = _v1
    ) INTO ok1;
  END IF;

  IF _k2 = 'national_id' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.family_members fm
      JOIN public.applications a ON a.id = fm.application_id
      WHERE a.user_id = uid AND fm.id = _q2 AND fm.national_id = _v2
    ) INTO ok2;
  ELSIF _k2 = 'birth_date' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.family_members fm
      JOIN public.applications a ON a.id = fm.application_id
      WHERE a.user_id = uid AND fm.id = _q2 AND fm.birth_date::text = _v2
    ) INTO ok2;
  END IF;

  RETURN ok1 AND ok2;
END; $$;