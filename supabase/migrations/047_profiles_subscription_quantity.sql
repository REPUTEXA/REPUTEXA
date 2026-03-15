-- Nombre d'établissements payés (quantité abonnement Stripe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_quantity INT DEFAULT 1;
UPDATE public.profiles SET subscription_quantity = 1 WHERE subscription_quantity IS NULL;
