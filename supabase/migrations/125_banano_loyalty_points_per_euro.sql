-- Points fidélité : crédit supplémentaire proportionnel au montant TTC saisi à la caisse (ex. 1 € = 1 point).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_points_per_euro NUMERIC(14, 6) NOT NULL DEFAULT 0
    CHECK (
      banano_loyalty_points_per_euro >= 0
      AND banano_loyalty_points_per_euro <= 100000
    );

COMMENT ON COLUMN public.profiles.banano_loyalty_points_per_euro IS
  'Mode Points : points ajoutés selon floor(montant_ttc_euros * ce taux), en plus des points par achat. 0 = ignorer le montant du ticket.';
