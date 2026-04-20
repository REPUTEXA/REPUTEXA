-- Thème d’illustration plein cadre (aperçu dashboard uniquement ; non inclus dans le .pkpass).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_theme_illustration_id TEXT;

COMMENT ON COLUMN public.profiles.banano_wallet_theme_illustration_id IS
  'Id thème illustration (bakery, butcher, …) pour l’aperçu passe Wallet ; null = pas d’illustration vectorielle de fond.';
