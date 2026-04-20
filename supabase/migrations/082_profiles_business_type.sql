-- Migration 082 : Ajout de la colonne business_type sur les profils
-- Valeurs : 'physical' (commerce physique) | 'online' (business en ligne)
-- Renseignée automatiquement depuis les métadonnées Stripe lors du checkout.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_type TEXT
    CHECK (business_type IN ('physical', 'online'))
    DEFAULT NULL;

COMMENT ON COLUMN profiles.business_type IS
  'Type de commerce du client : physical (boutique/restaurant) ou online (e-commerce). Alimenté par les métadonnées Stripe au moment du paiement.';
