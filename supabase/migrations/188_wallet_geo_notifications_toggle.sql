-- Interrupteur marchand : notifications géolocalisées sur le passe Wallet (locations Apple)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_geo_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.banano_wallet_geo_notifications_enabled IS
  'Si true et banano_wallet_geo_points non vide, les emplacements sont injectés dans le .pkpass (alertes à proximité).';
