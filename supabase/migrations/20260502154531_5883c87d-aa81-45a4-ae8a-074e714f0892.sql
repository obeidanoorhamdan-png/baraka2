-- 1) Unique constraint on profiles.national_id (head of family must be globally unique)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_national_id_unique'
  ) THEN
    -- Drop any rows that would violate? Skip — table should be clean. If duplicate exists, this will fail loudly.
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_national_id_unique UNIQUE (national_id);
  END IF;
END $$;

-- 2) Stronger helper: detect if a national_id is used anywhere by anyone except the given user/member
CREATE OR REPLACE FUNCTION public.national_id_used_by_others(
  _nid text,
  _exclude_user uuid DEFAULT NULL,
  _exclude_member uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE national_id = _nid
        AND (_exclude_user IS NULL OR id <> _exclude_user)
    )
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      JOIN public.applications a ON a.id = fm.application_id
      WHERE fm.national_id = _nid
        AND (_exclude_user IS NULL OR a.user_id <> _exclude_user)
        AND (_exclude_member IS NULL OR fm.id <> _exclude_member)
    );
$$;