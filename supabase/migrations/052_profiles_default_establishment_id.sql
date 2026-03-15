-- Établissement par défaut au démarrage (sélecteur gauche). NULL = profil principal.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_establishment_id UUID NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_default_establishment;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_default_establishment
  FOREIGN KEY (default_establishment_id)
  REFERENCES public.establishments(id)
  ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.default_establishment_id IS 'Établissement affiché par défaut au démarrage. NULL = profil principal (Mon établissement).';
