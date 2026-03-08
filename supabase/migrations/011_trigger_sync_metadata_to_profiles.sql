-- Synchronisation totale : metadata inscription + Google OAuth -> profiles
-- full_name, avatar_url (Google), establishment_name, phone
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

  -- Récupérer metadata : formulaire inscription OU Google OAuth (full_name, avatar_url/picture)
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
