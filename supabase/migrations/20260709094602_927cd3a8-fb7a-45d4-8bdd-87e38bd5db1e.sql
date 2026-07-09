-- إضافة رقم الأسرة (يحدده الأدمن يدوياً ويُستخدم للترتيب)
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS family_no integer;

CREATE INDEX IF NOT EXISTS idx_applications_family_no ON public.applications (family_no);

-- دالة آمنة لتعيين رقم الأسرة (المراجعون والأدمن فقط)
CREATE OR REPLACE FUNCTION public.admin_set_family_no(_app_id uuid, _family_no integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_review(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.applications
     SET family_no = _family_no,
         updated_at = now()
   WHERE id = _app_id;

  IF NOT FOUND THEN RETURN false; END IF;

  PERFORM public.log_admin_action(
    'set_family_no', 'application', _app_id::text, NULL,
    jsonb_build_object('family_no', _family_no)
  );
  RETURN true;
END $$;