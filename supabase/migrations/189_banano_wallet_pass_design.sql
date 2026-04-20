-- Design visuel Passe Wallet (profil marchand = ligne public.profiles)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_pass_background_color TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_pass_foreground_color TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_pass_label_color TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_logo_text TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_strip_image_url TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_custom_css TEXT;

COMMENT ON COLUMN public.profiles.banano_wallet_pass_background_color IS
  'Couleur fond passe Apple (ex. rgb(15, 23, 42) ou #0f172a).';
COMMENT ON COLUMN public.profiles.banano_wallet_pass_foreground_color IS
  'Couleur texte principal passe (ex. rgb(254, 243, 199)).';
COMMENT ON COLUMN public.profiles.banano_wallet_pass_label_color IS
  'Couleur libellés passe (ex. rgb(148, 163, 184)).';
COMMENT ON COLUMN public.profiles.banano_wallet_logo_text IS
  'Titre affiché en haut du passe (logoText Apple).';
COMMENT ON COLUMN public.profiles.banano_wallet_logo_url IS
  'URL publique image logo (Storage).';
COMMENT ON COLUMN public.profiles.banano_wallet_strip_image_url IS
  'URL publique bandeau strip storeCard (Storage).';
COMMENT ON COLUMN public.profiles.banano_wallet_custom_css IS
  'CSS optionnel pour prévisualisation dashboard (hors bundle .pkpass).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banano-wallet-assets',
  'banano-wallet-assets',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "banano_wallet_assets_insert_own" ON storage.objects;
CREATE POLICY "banano_wallet_assets_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'banano-wallet-assets'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "banano_wallet_assets_update_own" ON storage.objects;
CREATE POLICY "banano_wallet_assets_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'banano-wallet-assets'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'banano-wallet-assets'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "banano_wallet_assets_delete_own" ON storage.objects;
CREATE POLICY "banano_wallet_assets_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'banano-wallet-assets'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "banano_wallet_assets_read_public" ON storage.objects;
CREATE POLICY "banano_wallet_assets_read_public" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'banano-wallet-assets');
