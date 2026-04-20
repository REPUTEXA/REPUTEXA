-- Agent Ghost (caisse Windows) + Wallet : jetons API, verrou appareil, audit, géofence carte, fuzzy anti-doublon

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Jetons Bearer pour l’agent Windows (stockage hash SHA-256, jamais le secret en clair)
CREATE TABLE IF NOT EXISTS public.banano_ghost_agent_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  UNIQUE (token_sha256)
);

CREATE INDEX IF NOT EXISTS idx_banano_ghost_agent_tokens_user
  ON public.banano_ghost_agent_tokens (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.banano_ghost_agent_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_ghost_tokens_select_own" ON public.banano_ghost_agent_tokens;
CREATE POLICY "banano_ghost_tokens_select_own"
  ON public.banano_ghost_agent_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_ghost_tokens_insert_own" ON public.banano_ghost_agent_tokens;
CREATE POLICY "banano_ghost_tokens_insert_own"
  ON public.banano_ghost_agent_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_ghost_tokens_update_own" ON public.banano_ghost_agent_tokens;
CREATE POLICY "banano_ghost_tokens_update_own"
  ON public.banano_ghost_agent_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.banano_ghost_agent_tokens IS
  'Secrets API Agent Ghost caisse ; authentification côté serveur via hash SHA-256 du Bearer token.';

-- Un appareil (empreinte) = une carte active par enseigne
CREATE TABLE IF NOT EXISTS public.banano_wallet_device_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  device_fingerprint_sha256 TEXT NOT NULL,
  member_id UUID NOT NULL REFERENCES public.banano_loyalty_members (id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'unknown'
    CHECK (platform IN ('ios', 'android', 'desktop', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint_sha256)
);

CREATE INDEX IF NOT EXISTS idx_banano_wallet_device_locks_member
  ON public.banano_wallet_device_locks (member_id);

ALTER TABLE public.banano_wallet_device_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_wallet_device_locks_select_own" ON public.banano_wallet_device_locks;
CREATE POLICY "banano_wallet_device_locks_select_own"
  ON public.banano_wallet_device_locks FOR SELECT
  USING (auth.uid() = user_id);

-- Pas d’insert direct client : réservé service role (enrôlement public)

COMMENT ON TABLE public.banano_wallet_device_locks IS
  'Verrou matériel : un fingerprint d’appareil ne peut lier qu’un membre fidélité par commerçant.';

-- Traçabilité scans Agent / tickets (audit)
CREATE TABLE IF NOT EXISTS public.banano_ghost_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.banano_loyalty_members (id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'ghost_agent'
    CHECK (source IN ('ghost_agent', 'public_enroll', 'wallet_bind', 'system')),
  action TEXT NOT NULL
    CHECK (action IN (
      'scan_resolve',
      'transact_earn',
      'transact_redeem_points',
      'ticket_sniffer',
      'macro_play',
      'enroll',
      'device_bind'
    )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ticket_total_cents INT,
  ticket_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_ghost_audit_user_created
  ON public.banano_ghost_audit_events (user_id, created_at DESC);

ALTER TABLE public.banano_ghost_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_ghost_audit_select_own" ON public.banano_ghost_audit_events;
CREATE POLICY "banano_ghost_audit_select_own"
  ON public.banano_ghost_audit_events FOR SELECT
  USING (auth.uid() = user_id);

-- Jusqu’à 10 points GPS pour passes Wallet (géonotif / relevancy)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_geo_points JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.banano_wallet_geo_points IS
  'Tableau JSON : [{ "lat": number, "lon": number, "relevantText"?: string, "maxDistanceMeters"?: number }] max 10 entrées.';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS banano_wallet_geo_points_array_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT banano_wallet_geo_points_array_chk
  CHECK (jsonb_typeof(banano_wallet_geo_points) = 'array');

-- Métadonnées enrôlement (anti-fraude)
ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS enrollment_ip INET,
  ADD COLUMN IF NOT EXISTS enrollment_fingerprint_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_enrollment_fp
  ON public.banano_loyalty_members (user_id, enrollment_fingerprint_sha256)
  WHERE enrollment_fingerprint_sha256 IS NOT NULL;

-- Détection nom/prénom proche (Levenshtein sur chaîne normalisée)
CREATE OR REPLACE FUNCTION public.banano_enrollment_fuzzy_conflict(
  p_merchant UUID,
  p_first TEXT,
  p_last TEXT,
  p_max_distance INT DEFAULT 2
)
RETURNS TABLE (conflict_member_id UUID, distance INT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH norm AS (
    SELECT
      lower(regexp_replace(trim(COALESCE(p_first, '') || ' ' || COALESCE(p_last, '')), '\s+', ' ', 'g')) AS needle
  ),
  cand AS (
    SELECT
      m.id,
      lower(regexp_replace(trim(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), '\s+', ' ', 'g')) AS hay
    FROM public.banano_loyalty_members m
    WHERE m.user_id = p_merchant
  )
  SELECT c.id AS conflict_member_id,
         levenshtein(
           (SELECT needle FROM norm),
           CASE WHEN length(c.hay) < 1 THEN ' ' ELSE c.hay END
         )::INT AS distance
  FROM cand c
  WHERE levenshtein(
    (SELECT needle FROM norm),
    CASE WHEN length(c.hay) < 1 THEN ' ' ELSE c.hay END
  ) <= GREATEST(0, LEAST(10, p_max_distance))
  LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.banano_enrollment_fuzzy_conflict(UUID, TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banano_enrollment_fuzzy_conflict(UUID, TEXT, TEXT, INT) TO service_role;
