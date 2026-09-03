-- Extra descriptive fields used by the new family panel UI
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_status text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS prev_housing_status text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_governorate text;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS current_housing_type text;

-- Complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  national_id text,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reply text,
  handled_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own complaints select" ON public.complaints;
CREATE POLICY "own complaints select" ON public.complaints FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'reviewer'));

DROP POLICY IF EXISTS "own complaints insert" ON public.complaints;
CREATE POLICY "own complaints insert" ON public.complaints FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own complaints update" ON public.complaints;
CREATE POLICY "own complaints update" ON public.complaints FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'reviewer'));

DROP POLICY IF EXISTS "own complaints delete" ON public.complaints;
CREATE POLICY "own complaints delete" ON public.complaints FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));