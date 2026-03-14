-- Table pour stocker les codes OTP de confirmation d'inscription (6 chiffres)
-- Utilisée pour la vérification par code au lieu des liens magiques
CREATE TABLE IF NOT EXISTS public.signup_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_otps_email ON public.signup_otps(email);
CREATE INDEX IF NOT EXISTS idx_signup_otps_expires_at ON public.signup_otps(expires_at);

-- Nettoyage des codes expirés (optionnel, peut être fait par un cron)
-- RLS: pas besoin, cette table est accédée uniquement côté serveur (service role)
