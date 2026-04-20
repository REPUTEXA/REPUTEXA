-- Jetons à usage unique pour réinitialiser le PIN Banano (terminal / collecte d'avis) via lien e-mail.
-- Accès côté app : client service role uniquement (RLS sans politiques pour les rôles JWT).

CREATE TABLE IF NOT EXISTS public.banano_pin_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS banano_pin_reset_tokens_lookup_idx
  ON public.banano_pin_reset_tokens (token_hash)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS banano_pin_reset_tokens_user_created_idx
  ON public.banano_pin_reset_tokens (user_id, created_at DESC);

ALTER TABLE public.banano_pin_reset_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.banano_pin_reset_tokens IS 'Jetons hashed (SHA-256) pour réinitialisation PIN Banano ; utilisés depuis les routes API serveur (service role).';
