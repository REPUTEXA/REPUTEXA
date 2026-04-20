-- Équipe boutique : invitations WhatsApp, membres, audit, push (préparation).

-- Rôle profil : employé d’une enseigne (accès /staff, pas facturation marchand).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin', 'merchant_staff'));

CREATE TABLE IF NOT EXISTS public.merchant_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  phone_e164 TEXT NOT NULL,
  invitee_display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'manager')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_team_inv_merchant
  ON public.merchant_team_invitations (merchant_user_id, created_at DESC);

COMMENT ON TABLE public.merchant_team_invitations IS
  'Invitation salarié : lien /join/{token}, expirée après consumed_at ou expires_at.';

CREATE TABLE IF NOT EXISTS public.merchant_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'manager')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'revoked')),
  invitation_id UUID REFERENCES public.merchant_team_invitations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  UNIQUE (merchant_user_id, member_user_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_team_members_merchant
  ON public.merchant_team_members (merchant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_merchant_team_members_member
  ON public.merchant_team_members (member_user_id) WHERE status = 'active';

COMMENT ON TABLE public.merchant_team_members IS
  'Lien employé ↔ enseigne (merchant_user_id = UUID du profil marchand).';

CREATE TABLE IF NOT EXISTS public.merchant_team_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_team_audit_merchant
  ON public.merchant_team_audit_log (merchant_user_id, created_at DESC);

COMMENT ON TABLE public.merchant_team_audit_log IS
  'Journal actions équipe (invitation, révocation, changement de rôle).';

CREATE TABLE IF NOT EXISTS public.merchant_staff_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.merchant_staff_push_subscriptions IS
  'Web Push pour alertes dispatch vocal (clé VAPID côté serveur).';

CREATE OR REPLACE FUNCTION public.set_merchant_team_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_team_members_updated_at ON public.merchant_team_members;
CREATE TRIGGER merchant_team_members_updated_at
  BEFORE UPDATE ON public.merchant_team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_merchant_team_members_updated_at();

ALTER TABLE public.merchant_team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_team_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_staff_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Marchand : ses invitations et membres
CREATE POLICY merchant_team_inv_select ON public.merchant_team_invitations
  FOR SELECT USING (merchant_user_id = auth.uid());
CREATE POLICY merchant_team_inv_insert ON public.merchant_team_invitations
  FOR INSERT WITH CHECK (merchant_user_id = auth.uid());
CREATE POLICY merchant_team_inv_update ON public.merchant_team_invitations
  FOR UPDATE USING (merchant_user_id = auth.uid());

CREATE POLICY merchant_team_mem_select ON public.merchant_team_members
  FOR SELECT USING (
    merchant_user_id = auth.uid() OR member_user_id = auth.uid()
  );
CREATE POLICY merchant_team_mem_insert ON public.merchant_team_members
  FOR INSERT WITH CHECK (merchant_user_id = auth.uid());
CREATE POLICY merchant_team_mem_update ON public.merchant_team_members
  FOR UPDATE USING (merchant_user_id = auth.uid());

CREATE POLICY merchant_team_audit_select ON public.merchant_team_audit_log
  FOR SELECT USING (merchant_user_id = auth.uid());

CREATE POLICY merchant_staff_push_select ON public.merchant_staff_push_subscriptions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY merchant_staff_push_upsert ON public.merchant_staff_push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY merchant_staff_push_update ON public.merchant_staff_push_subscriptions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY merchant_staff_push_delete ON public.merchant_staff_push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- Inscription employé : profil minimal (signup_mode = merchant_staff dans user_metadata)
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

  IF mode_val = 'merchant_staff' THEN
    INSERT INTO public.profiles (
      id, email, establishment_name, establishment_type, full_name, avatar_url, phone, address,
      city, postal_code, country,
      trial_started_at, has_used_trial, subscription_plan, selected_plan,
      subscription_status, trial_ends_at, business_type, locale, language, role
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'merchant_establishment_name'), ''), ''),
      '',
      meta_name,
      '',
      meta_phone,
      '',
      '',
      '',
      '',
      NULL,
      false,
      'vision',
      'vision',
      'active',
      NULL,
      NULL,
      meta_locale,
      meta_locale,
      'merchant_staff'
    );
    RETURN NEW;
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
