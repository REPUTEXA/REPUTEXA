-- Bucket Storage pour les PDF des rapports mensuels (lecture par user uniquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'monthly-reports',
  'monthly-reports',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Service role / backend : INSERT (upload)
CREATE POLICY "monthly_reports_service_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'monthly-reports');

-- Utilisateurs : lecture de leurs rapports uniquement (path = user_id/...)
CREATE POLICY "monthly_reports_user_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'monthly-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
