-- Tous les inscrits reçoivent l'essai Zenith 14 jours — pas de carte à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  sub_status TEXT := 'trialing';
  trial_end TIMESTAMPTZ := now() + interval '14 days';
BEGIN
  INSERT INTO public.profiles (id, email, establishment_name, trial_started_at, has_used_trial, subscription_plan, selected_plan, subscription_status, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''),
    now(),
    true,
    'Dominator',
    'zenith',
    sub_status,
    trial_end
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
