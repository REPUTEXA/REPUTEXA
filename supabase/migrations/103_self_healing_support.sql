-- Self-healing support : backlog ingénieurs + mémoire dynamique (tickets résolus récents)

-- --- File technique (rapports auto-support → dev) --------------------------------
CREATE TABLE IF NOT EXISTS public.dev_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE NOT NULL,
  source_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  technical_summary TEXT NOT NULL DEFAULT '',
  suggested_fix TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wontfix')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_backlog_status_created
  ON public.dev_backlog(status, created_at DESC);

ALTER TABLE public.dev_backlog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_backlog_no_client"
  ON public.dev_backlog FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.dev_backlog IS 'Rapports techniques auto-générés par le support IA (accès service role uniquement)';

-- --- Mémoire courte « problème | solution » (alimentée à l''archivage ticket) -----
CREATE TABLE IF NOT EXISTS public.knowledge_base_dynamic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  problem_summary TEXT NOT NULL,
  solution_summary TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_base_dynamic_ticket_unique UNIQUE (source_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_dynamic_created
  ON public.knowledge_base_dynamic(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_dynamic_embedding_hnsw
  ON public.knowledge_base_dynamic USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

ALTER TABLE public.knowledge_base_dynamic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_base_dynamic_no_client"
  ON public.knowledge_base_dynamic FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.knowledge_base_dynamic IS 'Fiches Problème/Solution fraîches post-clôture — RAG temps réel';

-- --- RPC similarité (même convention que match_ai_learning_knowledge) ----------
CREATE OR REPLACE FUNCTION public.match_knowledge_base_dynamic(
  query_embedding vector(1536),
  match_count INT DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  problem_summary TEXT,
  solution_summary TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.id,
    k.problem_summary,
    k.solution_summary,
    (1 - (k.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.knowledge_base_dynamic k
  WHERE k.embedding IS NOT NULL
  ORDER BY k.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 24);
$$;
