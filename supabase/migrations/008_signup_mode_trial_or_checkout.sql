-- Tunnel de vente : mode=trial (essai 14j) ou mode=checkout (paiement immédiat)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  mode_val TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'signup_mode'), 'trial');
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'starter');
  selected TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'selected_plan'), 'pulse');
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
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''),
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
