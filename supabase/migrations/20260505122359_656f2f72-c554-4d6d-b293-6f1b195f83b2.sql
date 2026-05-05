-- Harden admin-only RPC: reject non-admin callers at the SQL level so
-- even bypassing the UI redirect cannot list incomplete accounts.
CREATE OR REPLACE FUNCTION public.list_incomplete_accounts()
 RETURNS TABLE(user_id uuid, full_name text, national_id text, phone text, created_at timestamp with time zone, reason text, application_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
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
END;
$function$;

-- Restrict execution to authenticated users only (RPC will then check the admin role internally).
REVOKE EXECUTE ON FUNCTION public.list_incomplete_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_incomplete_accounts() TO authenticated;

-- Same hardening for the phone hint RPC: only callable when authenticated.
REVOKE EXECUTE ON FUNCTION public.get_phone_hint(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_phone_hint(text) TO authenticated, anon;
-- (anon kept for the public "forgot data" recovery flow on the auth screen)