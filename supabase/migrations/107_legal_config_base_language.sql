-- Store the language of the AI-drafted "master" legal text before translations (pivot: English).
ALTER TABLE public.legal_config
  ADD COLUMN IF NOT EXISTS base_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.legal_config.base_language IS
  'BCP-47 style language code for the original AI draft (e.g. en) before localized translations.';
