-- Ajouter 'free' aux valeurs autorisées pour subscription_plan (essai expiré, paiement échoué)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN ('vision', 'pulse', 'zenith', 'free'));
