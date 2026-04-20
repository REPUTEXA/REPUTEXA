-- Période bonus fidélité : points / tampons en plus par achat (ex. « double points » le week-end).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_start_date DATE NULL,
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_end_date DATE NULL,
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_points_extra INT NOT NULL DEFAULT 0
    CHECK (banano_loyalty_bonus_points_extra >= 0 AND banano_loyalty_bonus_points_extra <= 100000),
  ADD COLUMN IF NOT EXISTS banano_loyalty_bonus_stamps_extra INT NOT NULL DEFAULT 0
    CHECK (banano_loyalty_bonus_stamps_extra >= 0 AND banano_loyalty_bonus_stamps_extra <= 10000);

COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_enabled IS
  'Si vrai et dates valides, crédit supplémentaire par achat sur la période.';
COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_start_date IS
  'Début inclus (jour calendaire Europe/Paris côté appli).';
COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_end_date IS
  'Fin inclusive.';
COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_points_extra IS
  'Points ajoutés à chaque achat en mode Points pendant la période active.';
COMMENT ON COLUMN public.profiles.banano_loyalty_bonus_stamps_extra IS
  'Tampons ajoutés à chaque achat en mode Tampons pendant la période active.';
