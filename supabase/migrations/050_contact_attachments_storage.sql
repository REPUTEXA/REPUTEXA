-- Bucket pour les pièces jointes du formulaire contact (photos, vidéos)
-- Limite 40MB total par email (Resend), on limite à 25MB par fichier
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contact-attachments',
  'contact-attachments',
  false,
  26214400,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
  ];

-- Backend (service role) : upload des pièces jointes
CREATE POLICY "contact_attachments_service_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'contact-attachments');
