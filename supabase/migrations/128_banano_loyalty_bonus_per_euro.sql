-- Bonus période : taux supplémentaire par € TTC (s’ajoute au taux de base avant arrondi).
-- Les colonnes *_points_extra / *_stamps_extra restent pour compat. « forfait par achat » (tampons sans €, ou anciennes configs).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_points_per_euro NUMERIC(14, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_stamps_per_euro NUMERIC(14, 6) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_banano_bonus_pts_per_euro_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_banano_bonus_pts_per_euro_check CHECK (
  banano_loyalty_bonus_points_per_euro >= 0::numeric
  AND banano_loyalty_bonus_points_per_euro <= 100000::numeric
);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_banano_bonus_stm_per_euro_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_banano_bonus_stm_per_euro_check CHECK (
  banano_loyalty_bonus_stamps_per_euro >= 0::numeric
  AND banano_loyalty_bonus_stamps_per_euro <= 100000::numeric
);

COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_points_per_euro IS
  'Points bonus par euro TTC sur la période (additif au taux base ; crédit = ceil(€ × (base + bonus))).';
COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_stamps_per_euro IS
  'Tampons bonus par euro TTC sur la période (additif au taux base ; idem arrondi supérieur).';
