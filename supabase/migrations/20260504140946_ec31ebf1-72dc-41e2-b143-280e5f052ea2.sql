-- Add is_head flag to family_members so the head of family can be persisted
-- as a member row alongside the rest of the household.
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS is_head boolean NOT NULL DEFAULT false;

-- Ensure at most one head per application.
CREATE UNIQUE INDEX IF NOT EXISTS family_members_one_head_per_app
  ON public.family_members (application_id)
  WHERE is_head = true;

-- Prevent duplicate national IDs within the same application
-- (DB-level safeguard backing the existing client-side validation).
CREATE UNIQUE INDEX IF NOT EXISTS family_members_app_nid_unique
  ON public.family_members (application_id, national_id)
  WHERE national_id IS NOT NULL;