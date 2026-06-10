-- Move admin_pin out of the publicly-readable app_settings table into a
-- dedicated admin-only table so anonymous/non-admin users can no longer read it.
CREATE TABLE IF NOT EXISTS public.admin_secrets (
  id integer PRIMARY KEY DEFAULT 1,
  admin_pin text NOT NULL DEFAULT '1234',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT admin_secrets_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE ON public.admin_secrets TO authenticated;
GRANT ALL ON public.admin_secrets TO service_role;

ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;

-- Migrate the existing PIN value (if present) before dropping the column.
INSERT INTO public.admin_secrets (id, admin_pin)
SELECT 1, COALESCE(admin_pin, '1234') FROM public.app_settings WHERE id = 1
ON CONFLICT (id) DO UPDATE SET admin_pin = EXCLUDED.admin_pin;

-- Only super admins may read or change the admin PIN.
CREATE POLICY "super reads admin secret" ON public.admin_secrets
  FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "super updates admin secret" ON public.admin_secrets
  FOR UPDATE USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
CREATE POLICY "super inserts admin secret" ON public.admin_secrets
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

-- Remove the exposed column from the public table.
ALTER TABLE public.app_settings DROP COLUMN IF EXISTS admin_pin;