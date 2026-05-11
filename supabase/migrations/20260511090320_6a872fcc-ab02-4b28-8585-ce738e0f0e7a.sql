-- profiles: any admin tier reads
DROP POLICY IF EXISTS "users select own profile" ON public.profiles;
CREATE POLICY "users select own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin_tier(auth.uid()));

-- applications: any admin tier reads, reviewer+ updates, super deletes
DROP POLICY IF EXISTS "users select own application" ON public.applications;
CREATE POLICY "users select own application" ON public.applications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin_tier(auth.uid()));

DROP POLICY IF EXISTS "users update own application" ON public.applications;
CREATE POLICY "users update own application" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id OR public.can_review(auth.uid()));

DROP POLICY IF EXISTS "admin delete application" ON public.applications;
CREATE POLICY "admin delete application" ON public.applications
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- family_members: any tier reads, reviewer+ writes
DROP POLICY IF EXISTS "view family members" ON public.family_members;
CREATE POLICY "view family members" ON public.family_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = family_members.application_id AND a.user_id = auth.uid())
    OR public.is_admin_tier(auth.uid())
  );
DROP POLICY IF EXISTS "update family members" ON public.family_members;
CREATE POLICY "update family members" ON public.family_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = family_members.application_id AND a.user_id = auth.uid())
    OR public.can_review(auth.uid())
  );
DROP POLICY IF EXISTS "delete family members" ON public.family_members;
CREATE POLICY "delete family members" ON public.family_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.applications a WHERE a.id = family_members.application_id AND a.user_id = auth.uid())
    OR public.can_review(auth.uid())
  );

-- aid_distributions
DROP POLICY IF EXISTS "admin manages aid" ON public.aid_distributions;
CREATE POLICY "tier reads aid" ON public.aid_distributions
  FOR SELECT USING (public.is_admin_tier(auth.uid()));
CREATE POLICY "distributor inserts aid" ON public.aid_distributions
  FOR INSERT WITH CHECK (public.can_distribute_aid(auth.uid()));
CREATE POLICY "distributor updates aid" ON public.aid_distributions
  FOR UPDATE USING (public.can_distribute_aid(auth.uid()))
  WITH CHECK (public.can_distribute_aid(auth.uid()));
CREATE POLICY "super deletes aid" ON public.aid_distributions
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- announcements
DROP POLICY IF EXISTS "admin manages announcements" ON public.announcements;
CREATE POLICY "anyone reads active announcements 2" ON public.announcements
  FOR SELECT USING (active = true OR public.is_admin_tier(auth.uid()));
DROP POLICY IF EXISTS "anyone reads active announcements" ON public.announcements;
CREATE POLICY "super manages announcements ins" ON public.announcements
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super manages announcements upd" ON public.announcements
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super manages announcements del" ON public.announcements
  FOR DELETE USING (public.is_super_admin(auth.uid()));

-- audit log: any tier reads, only super-tier writes (already guarded by function)
DROP POLICY IF EXISTS "admin reads audit" ON public.admin_audit_log;
CREATE POLICY "tier reads audit" ON public.admin_audit_log
  FOR SELECT USING (public.is_admin_tier(auth.uid()));

-- notifications: any admin tier inserts
DROP POLICY IF EXISTS "admin inserts notifications" ON public.notifications;
CREATE POLICY "admin tier inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.is_admin_tier(auth.uid()));
DROP POLICY IF EXISTS "users view own notifications" ON public.notifications;
CREATE POLICY "users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin_tier(auth.uid()));

-- user_roles: super-admin manages
DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;
CREATE POLICY "super manages roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- app_settings updates: super only
DROP POLICY IF EXISTS "admin updates settings" ON public.app_settings;
CREATE POLICY "super updates settings" ON public.app_settings
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "admin inserts settings" ON public.app_settings;
CREATE POLICY "super inserts settings" ON public.app_settings
  FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));

-- audit log function: allow any admin tier to write
CREATE OR REPLACE FUNCTION public.log_admin_action(_action text, _target_type text DEFAULT NULL, _target_id text DEFAULT NULL, _target_label text DEFAULT NULL, _details jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uname text;
BEGIN
  IF NOT public.is_admin_tier(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT full_name INTO uname FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.admin_audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
  VALUES (auth.uid(), uname, _action, _target_type, _target_id, _target_label, _details);
END $$;