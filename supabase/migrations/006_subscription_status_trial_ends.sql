-- Double entrée : subscription_status + trial_ends_at
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending' CHECK (subscription_status IN ('trialing', 'active', 'expired', 'pending'));

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at ON public.profiles(trial_ends_at);

-- Trigger mis à jour pour signup_mode=trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'starter');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'pulse');
  mode_val TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'signup_mode'), '');
  sub_status TEXT := 'pending';
  trial_end TIMESTAMPTZ := NULL;
BEGIN
  IF plan NOT IN ('starter', 'manager', 'Dominator') THEN plan := 'starter'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'pulse'; END IF;

  IF mode_val = 'trial' THEN
    sub_status := 'trialing';
    selected := 'zenith';
    plan := 'Dominator';
    trial_end := now() + interval '14 days';
  END IF;

  INSERT INTO public.profiles (id, email, establishment_name, trial_started_at, has_used_trial, subscription_plan, selected_plan, subscription_status, trial_ends_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''), now(), true, plan, selected, sub_status, trial_end);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
