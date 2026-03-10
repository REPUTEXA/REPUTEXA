-- Ajout de l'URL image aux suggestions produit (photos jointes)
ALTER TABLE public.app_suggestions
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.app_suggestions.image_url IS 'URL publique de la photo jointe (Supabase Storage)';

-- Bucket Storage pour les photos de suggestions (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'suggestion-images',
  'suggestion-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Politique : les utilisateurs authentifiés peuvent uploader
DROP POLICY IF EXISTS "suggestion_images_upload" ON storage.objects;
CREATE POLICY "suggestion_images_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'suggestion-images');

-- Politique : lecture publique (bucket public)
DROP POLICY IF EXISTS "suggestion_images_read" ON storage.objects;
CREATE POLICY "suggestion_images_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'suggestion-images');
