-- Nexus Support : audit des diagnostics/scans, verdicts RAG, actions en attente d'approbation humaine

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Audit : chaque scan / décision traçable (service role côté API)
CREATE TABLE IF NOT EXISTS public.support_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_id        UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  action_type      TEXT NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score SMALLINT CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_audit_log_ticket_created
  ON public.support_audit_log(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_audit_log_action_created
  ON public.support_audit_log(action_type, created_at DESC);

COMMENT ON TABLE public.support_audit_log IS
  'Nexus — journal des scans et événements (qui/quoi/confiance/lu) ; accès API service_role.';

-- ── Verdicts : mémoire structurée pour RAG (ticket fermé)
CREATE TABLE IF NOT EXISTS public.support_verdicts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id      UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  summary_clean  TEXT NOT NULL,
  technical_fix  TEXT NOT NULL,
  tags           TEXT[] NOT NULL DEFAULT '{}'::text[],
  embedding      vector(1536),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_verdicts_ticket_unique UNIQUE (ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_support_verdicts_created
  ON public.support_verdicts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_verdicts_embedding_hnsw
  ON public.support_verdicts
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

COMMENT ON TABLE public.support_verdicts IS
  'Nexus — solution constatée par ticket (RAG) ; complète ai_learning_knowledge.';

-- ── Actions WRITE : suggestion uniquement jusqu''approbation admin
CREATE TABLE IF NOT EXISTS public.support_pending_actions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   TEXT NOT NULL UNIQUE,
  ticket_id         UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  target_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name         TEXT NOT NULL,
  tool_input        JSONB NOT NULL DEFAULT '{}'::jsonb,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'executed', 'cancelled', 'expired')),
  approved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_pending_actions_ticket
  ON public.support_pending_actions(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_pending_actions_status
  ON public.support_pending_actions(status)
  WHERE status = 'pending';

COMMENT ON TABLE public.support_pending_actions IS
  'Nexus — outil WRITE proposé par l''IA ; exécution après POST admin avec idempotency_key.';

-- ── RLS : aucun accès client direct
ALTER TABLE public.support_audit_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_verdicts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_audit_log_no_client"
  ON public.support_audit_log FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "support_verdicts_no_client"
  ON public.support_verdicts FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "support_pending_actions_no_client"
  ON public.support_pending_actions FOR ALL
  USING (false) WITH CHECK (false);

-- ── RPC : similarité sur verdicts
CREATE OR REPLACE FUNCTION public.match_support_verdicts(
  query_embedding vector(1536),
  match_count     INT DEFAULT 8
)
RETURNS TABLE (
  id             UUID,
  ticket_id      UUID,
  summary_clean  TEXT,
  technical_fix  TEXT,
  tags           TEXT[],
  similarity     FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    v.id,
    v.ticket_id,
    v.summary_clean,
    v.technical_fix,
    v.tags,
    (1 - (v.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.support_verdicts v
  WHERE v.embedding IS NOT NULL
  ORDER BY v.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 32);
$$;

COMMENT ON FUNCTION public.match_support_verdicts(vector(1536), INT) IS
  'Nexus — recherche sémantique de verdicts passés (pgvector).';
