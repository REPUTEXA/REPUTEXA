-- Email pour envoi des notifications (J-3, J-0)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Plan affiché (vision, pulse, zenith) pour emails et dashboard
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS selected_plan TEXT DEFAULT 'pulse' CHECK (selected_plan IN ('vision', 'pulse', 'zenith'));

-- Trigger : enregistrer email + selected_plan depuis auth.users et metadata à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'starter');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'pulse');
BEGIN
  IF plan NOT IN ('starter', 'manager', 'Dominator') THEN
    plan := 'starter';
  END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN
    selected := 'pulse';
  END IF;
  INSERT INTO public.profiles (id, email, establishment_name, trial_started_at, has_used_trial, subscription_plan, selected_plan)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''),
    now(),
    true,
    plan,
    selected
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
