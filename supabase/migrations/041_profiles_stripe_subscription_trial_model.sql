-- Stripe 14j trial avec carte obligatoire : stripe_subscription_id + plus d'essai "maison"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Mise à jour des plans : Vision, Pulse, Zenith (remplace starter, manager, Dominator)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;

-- Migrer les anciennes valeurs vers les nouveaux plans
UPDATE public.profiles
SET subscription_plan = CASE LOWER(TRIM(subscription_plan))
  WHEN 'starter' THEN 'vision'
  WHEN 'manager' THEN 'pulse'
  WHEN 'dominator' THEN 'zenith'
  ELSE 'vision'
END
WHERE LOWER(TRIM(subscription_plan)) NOT IN ('vision', 'pulse', 'zenith');

ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IN ('vision', 'pulse', 'zenith'));
ALTER TABLE public.profiles ALTER COLUMN subscription_plan SET DEFAULT 'vision';

-- Plan par défaut : Vision (selected_plan a déjà vision/pulse/zenith)
ALTER TABLE public.profiles ALTER COLUMN selected_plan SET DEFAULT 'vision';

-- Trigger : ne plus attribuer trialing à l'inscription. Accès uniquement via Stripe (trialing/active).
-- Plans : Vision, Pulse, Zenith. Défaut : Vision. Mode trial : Zenith forcé.
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
  meta_phone TEXT;
  meta_address TEXT;
BEGIN
  IF plan NOT IN ('vision', 'pulse', 'zenith') THEN plan := 'vision'; END IF;
  IF selected NOT IN ('vision', 'pulse', 'zenith') THEN selected := 'vision'; END IF;

  meta_name := COALESCE(TRIM(NEW.raw_user_meta_data->>'full_name'), TRIM(NEW.raw_user_meta_data->>'name'), TRIM(NEW.raw_user_meta_data->>'contact_name'), '');
  meta_avatar := COALESCE(TRIM(NEW.raw_user_meta_data->>'avatar_url'), TRIM(NEW.raw_user_meta_data->>'picture'), '');
  meta_establishment := COALESCE(TRIM(NEW.raw_user_meta_data->>'establishment_name'), TRIM(NEW.raw_user_meta_data->>'business_name'), '');
  meta_phone := COALESCE(TRIM(NEW.raw_user_meta_data->>'phone'), '');
  meta_address := COALESCE(TRIM(NEW.raw_user_meta_data->>'address'), '');

  -- Mode trial : forcer Zenith (essai 14j via Stripe Checkout, carte requise)
  IF mode_val = 'trial' THEN
    selected := 'zenith';
    plan := 'zenith';
  END IF;

  INSERT INTO public.profiles (
    id, email, establishment_name, full_name, avatar_url, phone, address,
    trial_started_at, has_used_trial, subscription_plan, selected_plan, subscription_status, trial_ends_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    meta_establishment,
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
