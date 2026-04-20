-- Adresse client fidélité (saisie terminal / fiche / import), distinct du profil marchand.

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS address_line TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.banano_loyalty_members.address_line IS 'Adresse postale client (ligne rue / complément).';
COMMENT ON COLUMN public.banano_loyalty_members.city IS 'Ville client.';
COMMENT ON COLUMN public.banano_loyalty_members.postal_code IS 'Code postal client.';
COMMENT ON COLUMN public.banano_loyalty_members.country IS 'Pays client.';
