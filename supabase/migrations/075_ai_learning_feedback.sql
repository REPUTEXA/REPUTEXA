-- ────────────────────────────────────────────────────────────────────────────
-- Migration 075 : Architecture Reputexa Génesis — Mémoire Récursive v2
--
-- Trois extensions :
--   1. ai_learning_feedback   — mémoire négative (erreurs corrigées)
--   2. Colonnes Gold Standard  — is_gold_standard, gold_standard_score, tool_used
--   3. tool_call_log           — journalisation des outils (Bug de Design detector)
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. MÉMOIRE NÉGATIVE (erreurs corrigées pour ne jamais les répéter) ────────
CREATE TABLE IF NOT EXISTS public.ai_learning_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID        REFERENCES public.tickets(id) ON DELETE SET NULL,
  error_pattern    TEXT        NOT NULL,   -- description de l'erreur récurrente
  root_mistake     TEXT        NOT NULL,   -- cause de l'erreur de l'agent
  correct_approach TEXT        NOT NULL,   -- bonne approche retenue
  prevented_recurrence BOOLEAN NOT NULL DEFAULT false,
  feedback_embedding   vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_learning_feedback_ticket_unique UNIQUE (source_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_feedback_created
  ON public.ai_learning_feedback(created_at DESC);

-- Index vectoriel (HNSW cosinus) pour la recherche sémantique de la mémoire négative
CREATE INDEX IF NOT EXISTS idx_ai_learning_feedback_embedding
  ON public.ai_learning_feedback USING hnsw (feedback_embedding vector_cosine_ops)
  WHERE feedback_embedding IS NOT NULL;

-- ── 2. STANDARD D'OR sur ai_learning_knowledge ────────────────────────────────
-- Score de 1 à 10 attribué par Claude 3.5 lors de l'archivage.
-- ≥ 8 = méthode érigée en « Gold Standard », injectée en tête de contexte.
ALTER TABLE public.ai_learning_knowledge
  ADD COLUMN IF NOT EXISTS is_gold_standard    BOOLEAN  NOT NULL DEFAULT false;
ALTER TABLE public.ai_learning_knowledge
  ADD COLUMN IF NOT EXISTS gold_standard_score SMALLINT CHECK (gold_standard_score BETWEEN 1 AND 10);
ALTER TABLE public.ai_learning_knowledge
  ADD COLUMN IF NOT EXISTS tool_used           TEXT;    -- outil décisif, si applicable

CREATE INDEX IF NOT EXISTS idx_ai_learning_gold
  ON public.ai_learning_knowledge(is_gold_standard, created_at DESC)
  WHERE is_gold_standard = true;

-- ── 3. JOURNALISATION DES OUTILS (Bug de Design detector) ────────────────────
-- Chaque appel d'un outil est tracé. Si le même outil dépasse 5 appels sur 7 jours,
-- un incident "support_design_bug" est créé dans system_incidents.
CREATE TABLE IF NOT EXISTS public.tool_call_log (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id  UUID        REFERENCES public.tickets(id) ON DELETE SET NULL,
  tool_name  TEXT        NOT NULL,
  success    BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_call_log_name_created
  ON public.tool_call_log(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_call_log_user_created
  ON public.tool_call_log(user_id, created_at DESC);

-- ── RLS (accès service_role uniquement, aucun client direct) ─────────────────
ALTER TABLE public.ai_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_call_log        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_learning_feedback_no_client"
  ON public.ai_learning_feedback FOR ALL
  USING (false) WITH CHECK (false);

CREATE POLICY "tool_call_log_no_client"
  ON public.tool_call_log FOR ALL
  USING (false) WITH CHECK (false);

-- ── RPC : similarité sémantique sur la mémoire négative ──────────────────────
CREATE OR REPLACE FUNCTION public.match_ai_learning_feedback(
  query_embedding vector(1536),
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id               UUID,
  error_pattern    TEXT,
  root_mistake     TEXT,
  correct_approach TEXT,
  similarity       FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    f.id,
    f.error_pattern,
    f.root_mistake,
    f.correct_approach,
    (1 - (f.feedback_embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.ai_learning_feedback f
  WHERE f.feedback_embedding IS NOT NULL
  ORDER BY f.feedback_embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

-- ── RPC : comptage d'usage d'un outil (détection Bug de Design) ───────────────
CREATE OR REPLACE FUNCTION public.count_tool_usage(
  p_tool_name TEXT,
  p_days      INT DEFAULT 7
)
RETURNS TABLE (total_calls BIGINT, failure_count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    COUNT(*)                             AS total_calls,
    COUNT(*) FILTER (WHERE NOT success)  AS failure_count
  FROM public.tool_call_log
  WHERE tool_name = p_tool_name
    AND created_at >= now() - (p_days || ' days')::INTERVAL;
$$;

COMMENT ON TABLE public.ai_learning_feedback IS
  'Mémoire négative : erreurs corrigées. Consultée avant chaque réponse agent pour prévenir les récidives.';
COMMENT ON TABLE public.tool_call_log IS
  'Journalisation des appels d''outils agent. Alerte "Bug de Design" si un outil dépasse 5 appels/7 jours.';
