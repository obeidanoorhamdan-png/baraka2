
-- Auto-promote a designated admin email when they sign up
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'admin@baraka2.camp' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_admin() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin();

-- If the admin already exists (re-signup case), promote any matching user now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'admin@baraka2.camp'
ON CONFLICT DO NOTHING;
