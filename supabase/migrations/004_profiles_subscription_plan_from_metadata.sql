-- Récupérer le plan choisi depuis les metadata utilisateur à l'inscription
-- Valeurs autorisées : starter, manager, Dominator (cohérent avec le CHECK existant)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  plan TEXT := COALESCE(TRIM(NEW.raw_user_meta_data->>'subscription_plan'), 'starter');
BEGIN
  IF plan NOT IN ('starter', 'manager', 'Dominator') THEN
    plan := 'starter';
  END IF;
  INSERT INTO public.profiles (id, establishment_name, trial_started_at, has_used_trial, subscription_plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', ''),
    now(),
    true,
    plan
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
