DROP POLICY IF EXISTS "read announcement media" ON storage.objects;
CREATE POLICY "admin read announcement media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'announcement-media' AND public.is_admin_tier(auth.uid()));