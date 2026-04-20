-- Fidélité Banano : seuil & libellé (exigence produit) + crédits d’achat lus par l’API (zéro constante applicative).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_threshold INT NOT NULL DEFAULT 200
    CHECK (banano_loyalty_threshold >= 1 AND banano_loyalty_threshold <= 1000000),
  ADD COLUMN IF NOT EXISTS banano_loyalty_reward_text TEXT NOT NULL DEFAULT '10€ de remise',
  ADD COLUMN IF NOT EXISTS banano_loyalty_points_per_visit INT NOT NULL DEFAULT 10
    CHECK (banano_loyalty_points_per_visit >= 1 AND banano_loyalty_points_per_visit <= 100000),
  ADD COLUMN IF NOT EXISTS banano_loyalty_stamps_per_visit INT NOT NULL DEFAULT 1
    CHECK (banano_loyalty_stamps_per_visit >= 1 AND banano_loyalty_stamps_per_visit <= 10000);

COMMENT ON COLUMN public.profiles.banano_loyalty_threshold IS
  'Objectif points ou tampons (jauge max & montant débité au bouton Encaisser récompense).';
COMMENT ON COLUMN public.profiles.banano_loyalty_reward_text IS
  'Libellé affiché sur le terminal pour la récompense.';
COMMENT ON COLUMN public.profiles.banano_loyalty_points_per_visit IS
  'Points ajoutés à chaque « Achat » en mode Points.';
COMMENT ON COLUMN public.profiles.banano_loyalty_stamps_per_visit IS
  'Tampons ajoutés à chaque achat en mode Tampons.';
