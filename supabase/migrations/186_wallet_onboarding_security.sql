-- Onboarding Wallet express : unicité (auth client x commerçant), identité, empreinte appareil

-- Membre fidélité : compte client (auth) unique par enseigne (user_id = marchand)
ALTER TABLE public.banano_loyalty_members
  ALTER COLUMN phone_e164 DROP NOT NULL;

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users (id) ON DELETE CASCADE;

COMMENT ON COLUMN public.banano_loyalty_members.auth_user_id IS
  'Compte Supabase du client final (Wallet) ; NULL = fiche historique sans lien auth.';

CREATE UNIQUE INDEX IF NOT EXISTS banano_loyalty_members_auth_merchant_uniq
  ON public.banano_loyalty_members (auth_user_id, user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_auth_user
  ON public.banano_loyalty_members (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Profil consommateur Wallet : prénom / nom légaux + date de naissance + empreinte
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallet_given_name TEXT,
  ADD COLUMN IF NOT EXISTS wallet_family_name TEXT,
  ADD COLUMN IF NOT EXISTS wallet_birth_date DATE,
  ADD COLUMN IF NOT EXISTS device_fingerprint_sha256 TEXT;

COMMENT ON COLUMN public.profiles.wallet_given_name IS
  'Prénom issu OAuth Wallet (anti-fraude identité).';
COMMENT ON COLUMN public.profiles.wallet_family_name IS
  'Nom issu OAuth Wallet (anti-fraude identité).';
COMMENT ON COLUMN public.profiles.wallet_birth_date IS
  'Date de naissance saisie à l''onboarding Wallet.';
COMMENT ON COLUMN public.profiles.device_fingerprint_sha256 IS
  'Hash SHA-256 de l''empreinte navigateur (inscription Wallet).';

-- Anti-doublon identité : même trio (prénom, nom, date) sur un autre compte
CREATE OR REPLACE FUNCTION public.profiles_block_duplicate_wallet_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.wallet_given_name IS NULL
     OR NEW.wallet_family_name IS NULL
     OR NEW.wallet_birth_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND p.wallet_birth_date IS NOT NULL
      AND p.wallet_given_name IS NOT NULL
      AND p.wallet_family_name IS NOT NULL
      AND lower(trim(p.wallet_given_name)) = lower(trim(NEW.wallet_given_name))
      AND lower(trim(p.wallet_family_name)) = lower(trim(NEW.wallet_family_name))
      AND p.wallet_birth_date = NEW.wallet_birth_date
  ) THEN
    RAISE EXCEPTION 'WALLET_PROFILE_IDENTITY_DUPLICATE'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_duplicate_wallet_identity ON public.profiles;
CREATE TRIGGER profiles_duplicate_wallet_identity
  BEFORE INSERT OR UPDATE OF wallet_given_name, wallet_family_name, wallet_birth_date ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_duplicate_wallet_identity();

-- Suivi inscriptions par empreinte (limite 2 comptes distincts / 24h / appareil)
CREATE TABLE IF NOT EXISTS public.wallet_device_signup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint_sha256 TEXT NOT NULL,
  auth_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_fingerprint_sha256, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_device_signup_fp_created
  ON public.wallet_device_signup_events (device_fingerprint_sha256, created_at DESC);

COMMENT ON TABLE public.wallet_device_signup_events IS
  'Événements d''inscription Wallet pour limiter les abus multi-comptes par appareil.';

ALTER TABLE public.wallet_device_signup_events ENABLE ROW LEVEL SECURITY;

-- Alertes sécurité (service role uniquement en pratique)
CREATE TABLE IF NOT EXISTS public.wallet_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  device_fingerprint_sha256 TEXT,
  auth_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_security_alerts_created
  ON public.wallet_security_alerts (created_at DESC);

COMMENT ON TABLE public.wallet_security_alerts IS
  'Journal anti-fraude Wallet (ex. empreinte suspectée).';

ALTER TABLE public.wallet_security_alerts ENABLE ROW LEVEL SECURITY;
