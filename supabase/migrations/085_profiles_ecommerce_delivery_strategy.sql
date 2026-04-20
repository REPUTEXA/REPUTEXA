-- Migration 085 : Stratégie d'envoi après livraison (e-commerce, hors relance panier)
--
-- immediate_pleasure → 2h après scan "Livré" (vêtements, gadgets)
-- test_mount         → 24h après scan "Livré" (meubles, high-tech)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ecommerce_delivery_strategy TEXT NOT NULL DEFAULT 'immediate_pleasure';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ecommerce_delivery_strategy_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ecommerce_delivery_strategy_check
    CHECK (ecommerce_delivery_strategy IN ('immediate_pleasure', 'test_mount'));

COMMENT ON COLUMN public.profiles.ecommerce_delivery_strategy IS
  'E-commerce, demande d''avis après livraison : délai après statut Livré. immediate_pleasure=2h, test_mount=24h.';
