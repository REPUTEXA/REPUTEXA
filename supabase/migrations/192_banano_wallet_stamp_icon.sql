-- Icône tampon fidélité (aperçu Wallet Designer + futur rendu programme tampons)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_stamp_icon_id TEXT;

COMMENT ON COLUMN public.profiles.banano_wallet_stamp_icon_id IS
  'Id icône tampon (star, heart, coffee, …) pour aperçu et programme tampons.';
