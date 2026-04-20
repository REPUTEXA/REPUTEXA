-- Journal léger « Conseil des agents » : agrégat cron (lecture seule côté marchand).
-- Aucune exécution automatique d’actions sensibles — audit / transparence admin.

CREATE TABLE IF NOT EXISTS public.admin_council_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tick_kind TEXT NOT NULL DEFAULT 'scheduled',
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  consensus_note TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_council_digest_created
  ON public.admin_council_digest (created_at DESC);

ALTER TABLE public.admin_council_digest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_council_digest_no_client" ON public.admin_council_digest;
CREATE POLICY "admin_council_digest_no_client"
  ON public.admin_council_digest FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.admin_council_digest IS
  'Historique cron : synthèse multi-agents (Sentinel, Guardian, Forge, Nexus) — pas de side-effects.';
