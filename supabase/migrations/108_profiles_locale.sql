-- Locale UI / emails / PDF (fr, en, es, de, it). Source de vérité préférée pour le routage i18n côté profil.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'fr';

UPDATE public.profiles
SET locale = CASE
  WHEN lower(substring(trim(coalesce(language, preferred_language, 'fr')) from 1 for 2)) IN ('fr', 'en', 'es', 'de', 'it')
    THEN lower(substring(trim(coalesce(language, preferred_language, 'fr')) from 1 for 2))
  ELSE 'fr'
END;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_locale_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_locale_check
  CHECK (locale IN ('fr', 'en', 'es', 'de', 'it'));

COMMENT ON COLUMN public.profiles.locale IS
  'Locale interface & contenus transactionnels (emails, PDF) : fr | en | es | de | it.';
