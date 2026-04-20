-- Mode Tampons : crédit optionnel selon montant TTC (arrondi supérieur côté appli), comme les points.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_stamps_per_euro NUMERIC(14, 6) NOT NULL DEFAULT 0
    CHECK (
      banano_loyalty_stamps_per_euro >= 0
      AND banano_loyalty_stamps_per_euro <= 100000
    );

COMMENT ON COLUMN public.profiles.banano_loyalty_stamps_per_euro IS
  'Mode Tampons : tampons ajoutés selon ceil(montant_ttc_euros * taux) + tampons par achat + bonus. 0 = ignorer le montant ticket (forfait seulement).';
