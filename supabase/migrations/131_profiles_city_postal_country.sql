-- Localisation établissement : ville, code postal, pays + sync inscription (handle_new_user).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.profiles.city IS 'Ville de l’établissement (inscription / compte).';
COMMENT ON COLUMN public.profiles.postal_code IS 'Code postal de l’établissement.';
COMMENT ON COLUMN public.profiles.country IS 'Pays (texte libre, ex. France).';

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
  meta_establishment_type TEXT;
  meta_phone TEXT;
  meta_address TEXT;
  meta_city TEXT;
  meta_postal_code TEXT;
  meta_country TEXT;
  meta_business_type TEXT;
  meta_locale TEXT;
BEGIN
  IF plan NOT IN ('vision', 'pulse', 'zenith') THEN plan := 'vision'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'pulse'; END IF;

  meta_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'full_name'), TRIM(NEW.raw_user_meta_data->>'name'), TRIM(NEW.raw_user_meta_data->>'contact_name'), '');
  meta_avatar := COALESCE(TRIM(NEW.raw_user_meta_data->>'avatar_url'), TRIM(NEW.raw_user_meta_data->>'picture'), '');
  meta_establishment := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_name'), TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  meta_establishment_type := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_type'), '');
  meta_phone := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  meta_address := COALESCE(TRIM(NEW.raw_user_meta_data->>'address'), '');
  meta_city := COALESCE(TRIM(NEW.raw_user_meta_data->>'city'), '');
  meta_postal_code := COALESCE(
    TRIM(NEW.raw_user_meta_data->>'postal_code'),
    TRIM(NEW.raw_user_meta_data->>'postcode'),
    TRIM(NEW.raw_user_meta_data->>'zip'),
    ''
  );
  meta_country := COALESCE(TRIM(NEW.raw_user_meta_data->>'country'), '');
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
    id, email, establishment_name, establishment_type, full_name, avatar_url, phone, address,
    city, postal_code, country,
    trial_started_at, has_used_trial, subscription_plan, selected_plan,
    subscription_status, trial_ends_at, business_type, locale, language
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
    meta_city,
    meta_postal_code,
    meta_country,
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
