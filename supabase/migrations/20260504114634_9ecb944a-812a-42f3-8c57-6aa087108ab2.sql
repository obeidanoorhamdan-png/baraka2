CREATE TABLE IF NOT EXISTS public.application_drafts (
  user_id uuid PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.application_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own draft select" ON public.application_drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users manage own draft insert" ON public.application_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own draft update" ON public.application_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users manage own draft delete" ON public.application_drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_application_drafts_updated_at
  BEFORE UPDATE ON public.application_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();