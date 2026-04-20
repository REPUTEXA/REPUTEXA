-- Grace period : garder l'accès jusqu'à current_period_end
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
