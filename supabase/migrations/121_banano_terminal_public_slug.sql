-- Lien terminal personnalisé par commerce : /[locale]/terminal/[slug]

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_terminal_public_slug TEXT;

COMMENT ON COLUMN public.profiles.banano_terminal_public_slug IS
  'Segment d''URL public unique pour le mode terminal (non secret, anti-confusion entre enseignes).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_banano_terminal_public_slug
  ON public.profiles (banano_terminal_public_slug)
  WHERE banano_terminal_public_slug IS NOT NULL;
