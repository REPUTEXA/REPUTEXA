-- Points mode : crédit basé sur le montant TTC (taux au prorata, arrondi supérieur côté appli).
-- Ancien forfait « points par achat » peut être 0 ; taux euro à 1 si encore vide.

-- Migration 114 imposait >= 1 ; on autorise 0 (règle désactivée, crédit uniquement € × taux).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_banano_loyalty_points_per_visit_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_banano_loyalty_points_per_visit_check
  CHECK (banano_loyalty_points_per_visit >= 0 AND banano_loyalty_points_per_visit <= 100000);

COMMENT ON COLUMN public.profiles.banano_loyalty_points_per_visit IS
  'Héritage : forfait points par achat (0 = désactivé ; crédit mode Points via montant TTC × taux et bonus).';

UPDATE public.profiles
SET
  banano_loyalty_points_per_visit = CASE
    WHEN banano_loyalty_mode = 'points' THEN 0
    ELSE banano_loyalty_points_per_visit
  END,
  banano_loyalty_points_per_euro = CASE
    WHEN
      banano_loyalty_mode = 'points'
      AND (
        banano_loyalty_points_per_euro IS NULL
        OR banano_loyalty_points_per_euro <= 0
      )
      THEN 1
    ELSE banano_loyalty_points_per_euro
  END;
