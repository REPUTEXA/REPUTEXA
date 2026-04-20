-- Extension des devises de facturation profil : CAD / AUD (catalogue Stripe Canada & Australie).

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_billing_currency_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_currency_check CHECK (
    billing_currency IS NULL
    OR billing_currency IN ('eur', 'usd', 'gbp', 'jpy', 'cny', 'chf', 'cad', 'aud')
  );
