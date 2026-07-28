
CREATE POLICY "qimg read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-images');
CREATE POLICY "qimg admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "qimg admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "qimg admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));
