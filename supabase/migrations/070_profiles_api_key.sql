-- Migration 070 : Clé API publique par commerçant (format rtx_live_<uuid>)
--
-- Remplace le système header x-reputexa-token par une clé intégrée dans l'URL
-- du webhook. Format : rtx_live_<uuidv4>
--
-- Ex : POST https://reputexa.fr/api/webhooks/rtx_live_550e8400-e29b-41d4-a716-446655440000

-- ── 1. Ajouter la colonne (nullable d'abord pour le backfill) ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS api_key TEXT;

-- ── 2. Backfill : générer une clé unique pour chaque profil existant ──────────
UPDATE public.profiles
  SET api_key = 'rtx_live_' || gen_random_uuid()::text
  WHERE api_key IS NULL;

-- ── 3. Contrainte NOT NULL ────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN api_key SET NOT NULL;

-- ── 4. Default pour les nouveaux profils (évalué par ligne = UUID unique) ─────
ALTER TABLE public.profiles
  ALTER COLUMN api_key SET DEFAULT ('rtx_live_' || gen_random_uuid()::text);

-- ── 5. Contrainte UNIQUE + index pour lookup ultra-rapide ─────────────────────
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_api_key_unique UNIQUE (api_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_api_key
  ON public.profiles (api_key);

COMMENT ON COLUMN public.profiles.api_key IS
  'Clé API publique du commerçant — intégrée directement dans l''URL du webhook.
   Format : rtx_live_<uuidv4>. Chaque rotation révoque instantanément l''ancienne clé.';
