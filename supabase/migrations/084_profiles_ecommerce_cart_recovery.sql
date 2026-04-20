-- Migration 084 : Profil e-commerce + relance panier (Zenith)
--
-- business_category : ajout 'ecommerce' (Boutique en ligne — délai 2h post-livraison)
-- cart_recovery_enabled : si true avec ecommerce → messages type relance panier ; sinon demande d'avis

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_category_check;

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
      'ecommerce',
      'custom'
    ));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cart_recovery_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.cart_recovery_enabled IS
  'E-commerce uniquement : true = relance panier abandonné (WhatsApp) ; false = sollicitation avis après livraison (2h).';

COMMENT ON COLUMN public.profiles.business_category IS
  'Catégorie métier — délais adaptatifs Zenith. ecommerce=120min (post-livraison) ; avec cart_recovery_enabled pour le type de message (avis vs panier).';
