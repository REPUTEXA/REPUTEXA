-- Migration 068 : Catégorie métier pour le délai adaptatif de collecte d'avis
--
-- Utilisée par le webhook Zenith pour calculer automatiquement le délai post-visite
-- selon le type de commerce (sans avoir à configurer manuellement les minutes).
--
-- Valeurs autorisées :
--   restaurant   → 45 min  (temps de digestion + départ restaurant)
--   beauty       → 180 min (3h après un soin, laisse le temps de rentrer)
--   garage_hotel → 1440 min (24h : garage ou hôtel, check-out le lendemain)
--   fast_service → 20 min  (pharmacie, vente à emporter, service rapide)
--   custom       → utilise webhook_send_delay_minutes (configuration manuelle)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_category TEXT NOT NULL DEFAULT 'restaurant'
    CHECK (business_category IN ('restaurant', 'beauty', 'garage_hotel', 'fast_service', 'custom'));

-- Index pour les requêtes potentielles sur la catégorie
CREATE INDEX IF NOT EXISTS idx_profiles_business_category
  ON public.profiles (business_category);

COMMENT ON COLUMN public.profiles.business_category IS
  'Catégorie métier du commerçant — détermine le délai adaptatif de sollicitation avis WhatsApp.';
