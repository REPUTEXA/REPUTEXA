-- Type d'établissement (hôtel, restaurant, etc.)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS establishment_type TEXT DEFAULT '';

-- Sync establishment_type depuis metadata inscription vers profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  mode_val TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'signup_mode'), 'trial');
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'vision');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'vision');
  sub_status TEXT := 'pending';
  meta_name TEXT;
  meta_avatar TEXT;
  meta_establishment TEXT;
  meta_establishment_type TEXT;
  meta_phone TEXT;
  meta_address TEXT;
BEGIN
  IF plan NOT IN ('vision', 'pulse', 'zenith') THEN plan := 'vision'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'vision'; END IF;

  meta_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'full_name'), TRIM(NEW.raw_user_meta_data->>'name'), TRIM(NEW.raw_user_meta_data->>'contact_name'), '');
  meta_avatar := COALESCE(TRIM(NEW.raw_user_meta_data->>'avatar_url'), TRIM(NEW.raw_user_meta_data->>'picture'), '');
  meta_establishment := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_name'), TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  meta_establishment_type := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_type'), '');
  meta_phone := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  meta_address := COALESCE(TRIM(NEW.raw_user_meta_data->>'address'), '');

  -- Mode trial : forcer Zenith (essai 14j via Stripe Checkout)
  IF mode_val = 'trial' THEN
    selected := 'zenith';
    plan := 'zenith';
  END IF;

  INSERT INTO public.profiles (
    id, email, establishment_name, establishment_type, full_name, avatar_url, phone, address,
    trial_started_at, has_used_trial, subscription_plan, selected_plan, subscription_status, trial_ends_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    meta_establishment,
    meta_establishment_type,
    meta_name,
    meta_avatar,
    meta_phone,
    meta_address,
    NULL,
    false,
    plan,
    selected,
    sub_status,
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
