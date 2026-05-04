-- RPC: returns a masked hint of the registered phone for a given national_id.
-- Format: first 3 digits + asterisks + last 2 digits, e.g. "059****12".
CREATE OR REPLACE FUNCTION public.get_phone_hint(_nid text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ph text;
BEGIN
  SELECT phone INTO ph FROM public.profiles WHERE national_id = _nid LIMIT 1;
  IF ph IS NULL OR length(ph) < 5 THEN RETURN NULL; END IF;
  RETURN substr(ph, 1, 3) || repeat('*', length(ph) - 5) || substr(ph, length(ph) - 1, 2);
END; $$;

-- RPC for admin to list incomplete accounts: profiles with no application OR application without members,
-- older than 1 day.
CREATE OR REPLACE FUNCTION public.list_incomplete_accounts()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  national_id text,
  phone text,
  created_at timestamptz,
  reason text,
  application_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.national_id,
    p.phone,
    p.created_at,
    CASE
      WHEN a.id IS NULL THEN 'no_application'
      WHEN NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.application_id = a.id) THEN 'empty_application'
      ELSE 'incomplete'
    END,
    a.id
  FROM public.profiles p
  LEFT JOIN public.applications a ON a.user_id = p.id
  WHERE NOT public.has_role(p.id, 'admin')
    AND (
      a.id IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.application_id = a.id)
    )
  ORDER BY p.created_at DESC;
$$;