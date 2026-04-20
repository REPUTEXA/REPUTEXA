-- Médias (images / vidéos) associés aux communiqués manuels (app_updates)
ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.app_updates.attachments IS
  'Fichiers affichés avec le communiqué : tableau JSON [{ "url": "...", "type": "image" | "video" }]';

-- Bucket public lecture, écriture réservée aux admins (politique storage)
-- Pas de plafond taille / liste MIME : usage réservé aux admins via RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-update-media',
  'app-update-media',
  true,
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "app_update_media_upload_admin" ON storage.objects;
CREATE POLICY "app_update_media_upload_admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'app-update-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "app_update_media_read" ON storage.objects;
CREATE POLICY "app_update_media_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'app-update-media');
