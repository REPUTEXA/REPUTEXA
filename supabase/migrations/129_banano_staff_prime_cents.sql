ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_staff_prime_cents_per_client INT
  CHECK (
    banano_staff_prime_cents_per_client IS NULL
    OR (
      banano_staff_prime_cents_per_client >= 0
      AND banano_staff_prime_cents_per_client <= 1000000
    )
  );

COMMENT ON COLUMN public.profiles.banano_staff_prime_cents_per_client IS
  'Prime suggérée : montant en centimes par fiche client créée par un équipier (mois en cours, pilotage).';
