-- Recadrage manuel strip (focale + zoom), aligné PassKit / aperçu

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_strip_crop_json TEXT;

COMMENT ON COLUMN public.profiles.banano_wallet_strip_crop_json IS
  'JSON { focalX, focalY, zoom } pour le recadrage strip PassKit (optionnel, défaut archétype).';
