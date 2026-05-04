-- Helper to check if a national ID belongs to a registered head-of-family (profile owner).
-- Used by the unified ID-first auth flow to decide between login (existing) and signup (new).
CREATE OR REPLACE FUNCTION public.head_account_exists(_nid text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE national_id = _nid);
$$;