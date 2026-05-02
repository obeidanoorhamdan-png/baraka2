CREATE TABLE IF NOT EXISTS public.aid_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  title text NOT NULL,
  contents text,
  delivered_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aid_app ON public.aid_distributions(application_id);
CREATE INDEX IF NOT EXISTS idx_aid_delivered ON public.aid_distributions(delivered_at DESC);

ALTER TABLE public.aid_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages aid"
  ON public.aid_distributions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users view own aid"
  ON public.aid_distributions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.id = aid_distributions.application_id AND a.user_id = auth.uid()
  ));

CREATE TRIGGER trg_aid_updated_at
  BEFORE UPDATE ON public.aid_distributions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();