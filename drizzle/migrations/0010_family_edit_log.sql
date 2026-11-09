CREATE TABLE public.family_edit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_user_id uuid NOT NULL,
  actor_id uuid,
  target text NOT NULL,
  target_label text,
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_edit_log_user_idx ON public.family_edit_log(family_user_id, created_at DESC);
GRANT SELECT ON public.family_edit_log TO authenticated;
GRANT ALL ON public.family_edit_log TO service_role;
ALTER TABLE public.family_edit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Family reads own edit log" ON public.family_edit_log FOR SELECT TO authenticated
  USING (family_user_id = auth.uid() OR public.can_review(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_family_edit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid; _label text; _fields text[] := '{}'; _k text; _old jsonb; _new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN _old := to_jsonb(OLD); _new := '{}'::jsonb;
  ELSIF TG_OP = 'INSERT' THEN _old := '{}'::jsonb; _new := to_jsonb(NEW);
  ELSE _old := to_jsonb(OLD); _new := to_jsonb(NEW); END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    _uid := COALESCE(NEW.id, OLD.id); _label := COALESCE(_new->>'full_name', _old->>'full_name');
  ELSIF TG_TABLE_NAME = 'applications' THEN
    _uid := COALESCE((_new->>'user_id')::uuid, (_old->>'user_id')::uuid); _label := 'بيانات السكن';
  ELSE
    SELECT user_id INTO _uid FROM public.applications
      WHERE id = COALESCE((_new->>'application_id')::uuid, (_old->>'application_id')::uuid);
    _label := COALESCE(_new->>'full_name', _old->>'full_name');
  END IF;
  IF _uid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR _k IN SELECT jsonb_object_keys(_new) LOOP
      IF _k NOT IN ('updated_at','created_at') AND (_new->_k) IS DISTINCT FROM (_old->_k) THEN
        _fields := _fields || _k;
      END IF;
    END LOOP;
    IF array_length(_fields,1) IS NULL THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.family_edit_log(family_user_id, actor_id, target, target_label, action, changed_fields)
  VALUES (_uid, auth.uid(), TG_TABLE_NAME, _label, lower(TG_OP), _fields);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER family_edit_log_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_family_edit_log();
CREATE TRIGGER family_edit_log_apps AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.tg_family_edit_log();
CREATE TRIGGER family_edit_log_members AFTER INSERT OR UPDATE OR DELETE ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.tg_family_edit_log();