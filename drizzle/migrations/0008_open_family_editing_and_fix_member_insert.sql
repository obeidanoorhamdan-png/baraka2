CREATE OR REPLACE FUNCTION public.enforce_edit_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
COMMENT ON FUNCTION public.enforce_edit_lock() IS 'DEPRECATED: timed edit locking removed; ownership is enforced by RLS.';
COMMENT ON TABLE public.edit_grants IS 'DEPRECATED: timed edit permissions are no longer used; authenticated families may edit their own records.';
ALTER POLICY "insert family members" ON public.family_members TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = family_members.application_id AND (a.user_id = auth.uid() OR public.can_review(auth.uid()))));