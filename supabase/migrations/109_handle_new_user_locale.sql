-- Inscription : remplir locale (et language aligné) depuis les métadonnées Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  mode_val TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'signup_mode'), 'trial');
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'vision');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'pulse');
  sub_status TEXT := 'pending';
  trial_end TIMESTAMPTZ := NULL;
  meta_name TEXT;
  meta_avatar TEXT;
  meta_establishment TEXT;
  meta_phone TEXT;
  meta_business_type TEXT;
  meta_locale TEXT;
BEGIN
  IF plan NOT IN ('vision', 'pulse', 'zenith') THEN plan := 'vision'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'pulse'; END IF;

  meta_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'full_name'), TRIM(NEW.raw_user_meta_data->>'name'), TRIM(NEW.raw_user_meta_data->>'contact_name'), '');
  meta_avatar := COALESCE(TRIM(NEW.raw_user_meta_data->>'avatar_url'), TRIM(NEW.raw_user_meta_data->>'picture'), '');
  meta_establishment := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_name'), TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  meta_phone := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  meta_business_type := TRIM(NEW.raw_user_meta_data->>'business_type');

  meta_locale := lower(substring(trim(COALESCE(
    NEW.raw_user_meta_data->>'locale',
    NEW.raw_user_meta_data->>'language',
    NEW.raw_user_meta_data->>'preferred_language',
    'fr'
  )) from 1 for 2));
  IF meta_locale NOT IN ('fr', 'en', 'es', 'de', 'it') THEN
    meta_locale := 'fr';
  END IF;

  IF meta_business_type NOT IN ('physical', 'online') THEN
    meta_business_type := NULL;
  END IF;

  IF mode_val = 'trial' THEN
    selected := 'zenith';
    plan := 'zenith';
  END IF;

  INSERT INTO public.profiles (
    id, email, establishment_name, full_name, avatar_url, phone,
    trial_started_at, has_used_trial, subscription_plan, selected_plan,
    subscription_status, trial_ends_at, business_type, locale, language
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
    trial_end,
    meta_business_type,
    meta_locale,
    meta_locale
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
