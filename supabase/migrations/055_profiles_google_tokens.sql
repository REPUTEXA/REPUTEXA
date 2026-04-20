-- Tokens Google OAuth pour appels API (réponses aux avis, etc.) en dehors de la session.
-- Renseignés au retour de la connexion Google (scope business.manage, access_type=offline, prompt=consent).
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

COMMENT ON COLUMN public.profiles.google_access_token IS 'Access token Google (session courte). Renouvelé via google_refresh_token si besoin.';
COMMENT ON COLUMN public.profiles.google_refresh_token IS 'Refresh token Google. Nécessite access_type=offline et prompt=consent à la connexion.';
