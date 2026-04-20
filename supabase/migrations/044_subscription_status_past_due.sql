-- Autoriser subscription_status = 'past_due' (paiement échoué Stripe)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'expired', 'pending', 'past_due'));
