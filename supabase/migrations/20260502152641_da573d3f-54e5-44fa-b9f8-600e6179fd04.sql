
-- Unique national_id within family_members across all applications
-- (case where national_id is NULL is allowed, multiple NULLs ok)
CREATE UNIQUE INDEX IF NOT EXISTS family_members_national_id_unique
  ON public.family_members (national_id)
  WHERE national_id IS NOT NULL AND national_id <> '';

-- App settings (registration on/off + closure reason)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_open BOOLEAN NOT NULL DEFAULT true,
  closed_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO public.app_settings (id, registration_open) VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads settings" ON public.app_settings FOR SELECT
  USING (true);
CREATE POLICY "admin updates settings" ON public.app_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin inserts settings" ON public.app_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Helper: check if a national_id is already used anywhere (head profile or family member)
CREATE OR REPLACE FUNCTION public.national_id_exists(_nid TEXT, _exclude_user UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE national_id = _nid AND (_exclude_user IS NULL OR id <> _exclude_user)
  ) OR EXISTS (
    SELECT 1 FROM public.family_members fm
    JOIN public.applications a ON a.id = fm.application_id
    WHERE fm.national_id = _nid AND (_exclude_user IS NULL OR a.user_id <> _exclude_user)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.national_id_exists(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.national_id_exists(TEXT, UUID) TO authenticated;
