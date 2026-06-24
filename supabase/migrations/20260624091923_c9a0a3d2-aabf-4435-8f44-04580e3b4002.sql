-- Create a strict check that returns true ONLY for the exclusive 'super_admin' role,
-- not for the 'admin' role. Used to lock down direct writes to user_roles.
CREATE OR REPLACE FUNCTION public.is_only_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Tighten the role-management policy so that ordinary 'admin' users can no longer
-- INSERT/UPDATE/DELETE rows in user_roles (which would let them self-promote to super_admin).
-- Privileged role changes still flow through the SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "super manages roles" ON public.user_roles;
CREATE POLICY "super manages roles"
ON public.user_roles
FOR ALL
USING (public.is_only_super_admin(auth.uid()))
WITH CHECK (public.is_only_super_admin(auth.uid()));