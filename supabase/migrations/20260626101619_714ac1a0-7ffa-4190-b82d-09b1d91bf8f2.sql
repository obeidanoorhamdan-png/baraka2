-- Allow admin tier to manage announcement media, and authenticated to read (needed to sign URLs)
CREATE POLICY "admin upload announcement media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcement-media' AND is_admin_tier(auth.uid()));

CREATE POLICY "admin update announcement media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'announcement-media' AND is_admin_tier(auth.uid()));

CREATE POLICY "admin delete announcement media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'announcement-media' AND is_admin_tier(auth.uid()));

CREATE POLICY "read announcement media" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'announcement-media');