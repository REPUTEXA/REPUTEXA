-- Correctif : garantit que toutes les colonnes requises par handle_new_user existent
-- (évite "Database error saving new user" si migrations partielles)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_used_trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selected_plan TEXT DEFAULT 'pulse';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Recréer le trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  mode_val TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'signup_mode'), 'trial');
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'starter');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'pulse');
  sub_status TEXT := 'pending';
  trial_end TIMESTAMPTZ := NULL;
  meta_name TEXT;
  meta_avatar TEXT;
  meta_establishment TEXT;
  meta_phone TEXT;
BEGIN
  IF plan NOT IN ('starter', 'manager', 'Dominator') THEN plan := 'starter'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'pulse'; END IF;

  meta_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'full_name'), TRIM(NEW.raw_user_meta_data->>'name'), TRIM(NEW.raw_user_meta_data->>'contact_name'), '');
  meta_avatar := COALESCE(TRIM(NEW.raw_user_meta_data->>'avatar_url'), TRIM(NEW.raw_user_meta_data->>'picture'), '');
  meta_establishment := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_name'), TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  meta_phone := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  IF mode_val = 'trial' THEN
    sub_status := 'trialing';
    selected := 'zenith';
    plan := 'Dominator';
    trial_end := now() + interval '14 days';
  END IF;

  INSERT INTO public.profiles (
    id, email, establishment_name, full_name, avatar_url, phone,
    trial_started_at, has_used_trial, subscription_plan, selected_plan, subscription_status, trial_ends_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    meta_establishment,
    meta_name,
    meta_avatar,
    meta_phone,
    now(),
    true,
    plan,
    selected,
    sub_status,
    trial_end
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
