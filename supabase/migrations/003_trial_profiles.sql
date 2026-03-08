-- Essai gratuit 7 jours : colonnes sur profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN NOT NULL DEFAULT false;

-- Trigger: à l'inscription, démarrer l'essai
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, establishment_name, trial_started_at, has_used_trial)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''),
    now(),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
