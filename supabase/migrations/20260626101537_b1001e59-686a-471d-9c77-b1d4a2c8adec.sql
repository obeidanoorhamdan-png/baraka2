ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS show_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_in_strip boolean NOT NULL DEFAULT true;