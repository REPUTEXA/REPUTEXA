-- Devise de facturation Stripe (verrouillée après premier checkout réussi) ; alignée sur l’abonnement.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS billing_currency TEXT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_billing_currency_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_currency_check
  CHECK (
    billing_currency IS NULL
    OR billing_currency IN ('eur', 'usd', 'gbp', 'jpy', 'cny', 'chf')
  );

COMMENT ON COLUMN public.profiles.billing_currency IS
  'Devise catalogue Stripe au premier paiement (abonnement). Une fois définie, l’UI et les sessions Checkout utilisent cette valeur.';
