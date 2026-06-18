CREATE OR REPLACE FUNCTION public.admin_update_head(
  _user_id uuid,
  _full_name text DEFAULT NULL,
  _national_id text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _alt_phone text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _gender public.gender DEFAULT NULL,
  _marital_status public.marital_status DEFAULT NULL,
  _chronic_diseases text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET
    full_name = COALESCE(_full_name, full_name),
    national_id = COALESCE(_national_id, national_id),
    phone = COALESCE(_phone, phone),
    alt_phone = _alt_phone,
    birth_date = COALESCE(_birth_date, birth_date),
    gender = COALESCE(_gender, gender),
    marital_status = COALESCE(_marital_status, marital_status),
    chronic_diseases = _chronic_diseases,
    updated_at = now()
  WHERE id = _user_id;

  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM public.log_admin_action(
    'edit_head', 'profile', _user_id::text, _full_name, NULL
  );
  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_update_head(uuid, text, text, text, text, date, public.gender, public.marital_status, text) TO authenticated;