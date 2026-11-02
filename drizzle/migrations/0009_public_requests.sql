CREATE TABLE public.public_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE DEFAULT ('B2-' || upper(substr(md5(gen_random_uuid()::text),1,6))),
  national_id text NOT NULL,
  family_user_id uuid,
  head_name text,
  phone text,
  kind text NOT NULL DEFAULT 'complaint',
  category text,
  priority text NOT NULL DEFAULT 'normal',
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_reply text,
  handled_by uuid,
  handled_by_name text,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.public_requests TO authenticated;
GRANT ALL ON public.public_requests TO service_role;
ALTER TABLE public.public_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviewers read requests" ON public.public_requests FOR SELECT TO authenticated USING (public.can_review(auth.uid()));
CREATE POLICY "Reviewers update requests" ON public.public_requests FOR UPDATE TO authenticated USING (public.can_review(auth.uid())) WITH CHECK (public.can_review(auth.uid()));
CREATE POLICY "Admins delete requests" ON public.public_requests FOR DELETE TO authenticated USING (public.is_admin_tier(auth.uid()));
CREATE TRIGGER public_requests_updated BEFORE UPDATE ON public.public_requests FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_public_request(_nid text, _kind text, _category text, _priority text, _subject text, _body text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _name text; _t text; _recent int;
BEGIN
  IF _nid !~ '^[0-9]{9}$' THEN RAISE EXCEPTION 'رقم الهوية يجب أن يكون 9 أرقام'; END IF;
  IF _kind NOT IN ('complaint','help') THEN RAISE EXCEPTION 'نوع غير صالح'; END IF;
  IF length(coalesce(trim(_subject),'')) < 3 OR length(_subject) > 120 THEN RAISE EXCEPTION 'العنوان بين 3 و120 حرفاً'; END IF;
  IF length(coalesce(trim(_body),'')) < 10 OR length(_body) > 2000 THEN RAISE EXCEPTION 'التفاصيل بين 10 و2000 حرف'; END IF;
  SELECT count(*) INTO _recent FROM public_requests WHERE national_id=_nid AND created_at > now() - interval '1 hour';
  IF _recent >= 5 THEN RAISE EXCEPTION 'تم إرسال طلبات كثيرة، حاول لاحقاً'; END IF;
  SELECT id, full_name INTO _uid, _name FROM profiles WHERE national_id=_nid LIMIT 1;
  IF _uid IS NULL THEN
    SELECT a.user_id, p.full_name INTO _uid, _name FROM family_members m JOIN applications a ON a.id=m.application_id JOIN profiles p ON p.id=a.user_id WHERE m.national_id=_nid LIMIT 1;
  END IF;
  IF _uid IS NULL THEN RAISE EXCEPTION 'رقم الهوية غير مسجل في المخيم'; END IF;
  INSERT INTO public_requests(national_id,family_user_id,head_name,phone,kind,category,priority,subject,body)
  VALUES (_nid,_uid,_name,nullif(left(trim(coalesce(_phone,'')),20),''),_kind,left(_category,60),
    CASE WHEN _priority IN ('normal','urgent') THEN _priority ELSE 'normal' END,trim(_subject),trim(_body))
  RETURNING ticket_no INTO _t;
  RETURN jsonb_build_object('ticket_no',_t,'head_name',_name);
END $$;

CREATE OR REPLACE FUNCTION public.track_public_requests(_nid text)
RETURNS TABLE(ticket_no text, kind text, subject text, status text, admin_reply text, created_at timestamptz, handled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ticket_no, kind, subject, status, admin_reply, created_at, handled_at FROM public_requests
  WHERE national_id = _nid AND _nid ~ '^[0-9]{9}$' ORDER BY created_at DESC LIMIT 20
$$;
GRANT EXECUTE ON FUNCTION public.submit_public_request(text,text,text,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_public_requests(text) TO anon, authenticated;