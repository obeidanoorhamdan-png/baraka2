ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_card_url text,
  ADD COLUMN IF NOT EXISTS is_university_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS university_major text,
  ADD COLUMN IF NOT EXISTS university_name text,
  ADD COLUMN IF NOT EXISTS university_year text;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS birth_certificate_url text,
  ADD COLUMN IF NOT EXISTS is_university_student boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS university_major text,
  ADD COLUMN IF NOT EXISTS university_name text,
  ADD COLUMN IF NOT EXISTS university_year text;

DROP POLICY IF EXISTS "Admins manage medical reports" ON storage.objects;
CREATE POLICY "Admins manage medical reports" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'medical-reports' AND public.is_admin_tier(auth.uid()))
  WITH CHECK (bucket_id = 'medical-reports' AND public.is_admin_tier(auth.uid()));

CREATE OR REPLACE FUNCTION public.public_family_lookup(_nid text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid; _p record; _a record; _res jsonb;
BEGIN
  IF _nid IS NULL OR _nid !~ '^\d{9}$' THEN RETURN NULL; END IF;
  SELECT id INTO _uid FROM profiles WHERE national_id = _nid LIMIT 1;
  IF _uid IS NULL THEN
    SELECT a.user_id INTO _uid FROM family_members fm JOIN applications a ON a.id = fm.application_id
      WHERE fm.national_id = _nid LIMIT 1;
  END IF;
  IF _uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _p FROM profiles WHERE id = _uid;
  SELECT * INTO _a FROM applications WHERE user_id = _uid LIMIT 1;
  _res := jsonb_build_object(
    'head', jsonb_build_object(
      'full_name', _p.full_name, 'national_id', _p.national_id, 'birth_date', _p.birth_date,
      'gender', _p.gender, 'marital_status', _p.marital_status, 'phone', _p.phone, 'alt_phone', _p.alt_phone,
      'work_status', _p.work_status, 'chronic_diseases', _p.chronic_diseases, 'is_war_injured', _p.is_war_injured,
      'is_special_needs', _p.is_special_needs, 'has_id_card', _p.id_card_url IS NOT NULL,
      'is_university_student', _p.is_university_student, 'university_major', _p.university_major,
      'university_name', _p.university_name, 'university_year', _p.university_year),
    'app', CASE WHEN _a.id IS NULL THEN NULL ELSE jsonb_build_object(
      'status', _a.status, 'family_no', _a.family_no, 'family_size', _a.family_size,
      'original_residence', _a.original_residence, 'original_landmark', _a.original_landmark,
      'current_governorate', _a.current_governorate, 'current_camp', _a.current_camp,
      'current_landmark', _a.current_landmark, 'current_housing_type', _a.current_housing_type,
      'prev_housing_status', _a.prev_housing_status) END,
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'full_name', fm.full_name, 'national_id', fm.national_id, 'birth_date', fm.birth_date,
      'gender', fm.gender, 'relationship', fm.relationship, 'chronic_diseases', fm.chronic_diseases,
      'is_war_injured', fm.is_war_injured, 'is_special_needs', fm.is_special_needs,
      'is_pregnant', fm.is_pregnant, 'is_breastfeeding', fm.is_breastfeeding,
      'has_birth_certificate', fm.birth_certificate_url IS NOT NULL,
      'is_university_student', fm.is_university_student, 'university_major', fm.university_major,
      'university_name', fm.university_name, 'university_year', fm.university_year) ORDER BY fm.created_at)
      FROM family_members fm WHERE fm.application_id = _a.id AND NOT fm.is_head), '[]'::jsonb)
  );
  RETURN _res;
END $$;
GRANT EXECUTE ON FUNCTION public.public_family_lookup(text) TO anon, authenticated;