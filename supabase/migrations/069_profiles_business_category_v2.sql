-- Migration 069 : Extension des catégories métier (plan de vol complet)
--
-- Remplace la contrainte CHECK de 068 pour ajouter :
--   bakery       → boulangerie / pâtisserie (120 min)
--   garage       → garage auto (24h) — séparé de hotel
--   hotel        → hôtellerie (2h post check-out)
--   artisan      → artisan / prestataire de service (4h)

-- 1. Supprimer l'ancienne contrainte
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_category_check;

-- 2. Recréer avec l'ensemble des catégories
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_category_check
    CHECK (business_category IN (
      'restaurant',
      'bakery',
      'beauty',
      'garage',
      'hotel',
      'artisan',
      'fast_service',
      'custom'
    ));

-- 3. Mettre à jour les valeurs obsolètes 'garage_hotel' → 'garage' (migration douce)
UPDATE public.profiles
  SET business_category = 'garage'
  WHERE business_category = 'garage_hotel';

-- 4. Mettre à jour les valeurs obsolètes 'fastservice' → 'fast_service'
UPDATE public.profiles
  SET business_category = 'fast_service'
  WHERE business_category = 'fastservice';

COMMENT ON COLUMN public.profiles.business_category IS
  'Catégorie métier — détermine le délai adaptatif de sollicitation avis WhatsApp.
   restaurant=45min, bakery=120min, beauty=180min, garage=24h, hotel=2h, artisan=4h, fast_service=20min, custom=libre.';
