-- Migration 086 : Délai personnalisé après livraison (e-commerce)
--
-- Stratégie "custom" + ecommerce_post_delivery_custom_minutes (minutes après scan Livré).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ecommerce_post_delivery_custom_minutes INTEGER;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ecommerce_delivery_strategy_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ecommerce_delivery_strategy_check
  CHECK (ecommerce_delivery_strategy IN ('immediate_pleasure', 'test_mount', 'custom'));

COMMENT ON COLUMN public.profiles.ecommerce_post_delivery_custom_minutes IS
  'E-commerce, stratégie custom uniquement : délai en minutes après scan Livré (30–10080).';

COMMENT ON COLUMN public.profiles.ecommerce_delivery_strategy IS
  'E-commerce, avis après livraison : immediate_pleasure=2h, test_mount=24h, custom=ecommerce_post_delivery_custom_minutes.';
