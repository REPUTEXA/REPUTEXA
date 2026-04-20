-- Langue utilisateur pour i18n (FR, EN, IT, ES, DE). Détection possible via indicatif téléphone.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';

-- Aligner les profils existants sur preferred_language si présent
UPDATE public.profiles
SET language = COALESCE(preferred_language, 'fr')
WHERE language IS NULL OR language = '';
