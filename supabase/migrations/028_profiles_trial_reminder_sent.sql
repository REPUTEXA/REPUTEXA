-- Empêcher l'envoi multiple du rappel J-3
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_reminder_sent BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_trial_reminder_sent ON public.profiles(trial_reminder_sent) WHERE trial_reminder_sent = false;
