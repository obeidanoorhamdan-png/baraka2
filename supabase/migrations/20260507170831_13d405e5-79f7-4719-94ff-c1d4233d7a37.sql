
-- Applications additions
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS martyr_death_certificate_url text,
  ADD COLUMN IF NOT EXISTS is_female_breadwinner boolean NOT NULL DEFAULT false;

-- Profiles additions (head of family)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_special_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_needs_report_url text,
  ADD COLUMN IF NOT EXISTS chronic_disease_report_url text;

-- Family member additions
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS is_special_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_needs_report_url text,
  ADD COLUMN IF NOT EXISTS chronic_disease_report_url text;

-- Public announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'general', -- general | meeting | session | aid | warning
  organizer text, -- e.g. UNICEF, WFP, إدارة المخيم
  event_at timestamptz, -- when meeting/session happens
  target_age_min int,
  target_age_max int,
  target_gender text, -- 'male' | 'female' | null
  target_camp text,
  target_special text, -- e.g. injured, pregnant, martyr_family, special_needs, female_breadwinner
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads active announcements" ON public.announcements;
CREATE POLICY "anyone reads active announcements"
ON public.announcements FOR SELECT
USING (active = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin manages announcements" ON public.announcements;
CREATE POLICY "admin manages announcements"
ON public.announcements FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tg_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
