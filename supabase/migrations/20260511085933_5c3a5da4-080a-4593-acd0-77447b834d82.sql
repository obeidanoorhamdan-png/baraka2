ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aid_distributor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';