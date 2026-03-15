-- Premier login : onboarding Joyride (true = afficher le tour)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT true;
