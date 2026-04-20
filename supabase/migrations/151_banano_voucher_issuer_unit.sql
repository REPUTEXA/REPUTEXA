-- Distingue bons émis au seuil points vs tampons (archive / messages).

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS issuer_unit TEXT NOT NULL DEFAULT 'points'
    CHECK (issuer_unit IN ('points', 'stamps'));

COMMENT ON COLUMN public.banano_loyalty_vouchers.issuer_unit IS
  'Programme actif à l''émission : points ou tampons. Le champ points_balance_after stocke le reliquat dans cette même unité.';
