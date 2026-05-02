
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.marital_status AS ENUM ('married', 'single', 'widowed', 'divorced', 'other');
CREATE TYPE public.gender AS ENUM ('male', 'female');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.relationship AS ENUM ('wife','husband','son','daughter','father','mother','brother','sister','other');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  birth_date DATE NOT NULL,
  gender public.gender NOT NULL,
  marital_status public.marital_status NOT NULL,
  marital_status_other TEXT,
  -- health info for head of family
  is_war_injured BOOLEAN NOT NULL DEFAULT false,
  injury_report_url TEXT,
  chronic_diseases TEXT,
  health_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- has_role function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  original_residence TEXT NOT NULL,
  original_landmark TEXT NOT NULL,
  current_camp TEXT NOT NULL DEFAULT 'Baraka 2',
  current_landmark TEXT NOT NULL,
  family_size INTEGER NOT NULL CHECK (family_size >= 1),
  has_martyr BOOLEAN NOT NULL DEFAULT false,
  martyr_name TEXT,
  martyr_relationship TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- family_members
CREATE TABLE public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  national_id TEXT,
  birth_date DATE NOT NULL,
  gender public.gender NOT NULL,
  relationship public.relationship NOT NULL,
  relationship_other TEXT,
  is_war_injured BOOLEAN NOT NULL DEFAULT false,
  injury_report_url TEXT,
  chronic_diseases TEXT,
  is_pregnant BOOLEAN NOT NULL DEFAULT false,
  is_breastfeeding BOOLEAN NOT NULL DEFAULT false,
  health_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile + user role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, national_id, full_name, email, phone, alt_phone, birth_date, gender,
    marital_status, marital_status_other, is_war_injured, chronic_diseases, health_notes
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'national_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
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
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "users select own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- applications policies
CREATE POLICY "users select own application" ON public.applications FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own application" ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own application" ON public.applications FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete application" ON public.applications FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- family_members policies
CREATE POLICY "view family members" ON public.family_members FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "insert family members" ON public.family_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
  );
CREATE POLICY "update family members" ON public.family_members FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "delete family members" ON public.family_members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Storage bucket for medical reports
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-reports', 'medical-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: user uploads to own folder, admin can read all
CREATE POLICY "users upload own reports" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "users read own reports" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-reports'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "users update own reports" ON storage.objects FOR UPDATE
  USING (bucket_id = 'medical-reports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own reports" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'medical-reports'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );
