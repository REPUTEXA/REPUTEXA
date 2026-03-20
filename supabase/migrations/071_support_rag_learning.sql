-- Support client IA : tickets, ticket_messages, base d'apprentissage, chunks code (RAG pgvector)

CREATE EXTENSION IF NOT EXISTS vector;

-- --- Tickets (un dossier de conversation par utilisateur)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON public.tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_updated ON public.tickets(updated_at DESC);

-- --- Messages (user / ai)
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at);

-- --- Résumés post-archivage (lecture côté serveur uniquement via service role)
CREATE TABLE IF NOT EXISTS public.ai_learning_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  root_cause TEXT NOT NULL,
  effective_solution TEXT NOT NULL,
  prevention TEXT NOT NULL,
  summary_embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_learning_knowledge_ticket_unique UNIQUE (source_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_knowledge_created ON public.ai_learning_knowledge(created_at DESC);

-- Index ANN cosinus (HNSW — pas d'entraînement préalable)
CREATE INDEX IF NOT EXISTS idx_ai_learning_embedding_hnsw
  ON public.ai_learning_knowledge USING hnsw (summary_embedding vector_cosine_ops);

-- --- Base vectorielle code (remplie par script d'indexation)
CREATE TABLE IF NOT EXISTS public.code_kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT code_kb_chunks_path_idx UNIQUE (file_path, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_code_kb_embedding_hnsw
  ON public.code_kb_chunks USING hnsw (embedding vector_cosine_ops);

-- --- RLS : tickets & messages = propriétaire uniquement
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select_own"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tickets_insert_own"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tickets_update_own"
  ON public.tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ticket_messages_select_own"
  ON public.ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "ticket_messages_insert_own"
  ON public.ticket_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Pas d'accès client direct aux tables globales RAG / apprentissage (service role API)
ALTER TABLE public.ai_learning_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_learning_no_client"
  ON public.ai_learning_knowledge FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "code_kb_no_client"
  ON public.code_kb_chunks FOR ALL
  USING (false)
  WITH CHECK (false);

-- --- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_ticket_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets SET updated_at = now() WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_ticket_messages_touch_updated ON public.ticket_messages;
CREATE TRIGGER tr_ticket_messages_touch_updated
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ticket_updated_at();

-- --- RPC : similarité cosinus (distance <=>)
CREATE OR REPLACE FUNCTION public.match_code_kb_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id,
    c.file_path,
    c.content,
    (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.code_kb_chunks c
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 32);
$$;

CREATE OR REPLACE FUNCTION public.match_ai_learning_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  root_cause TEXT,
  effective_solution TEXT,
  prevention TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    k.id,
    k.root_cause,
    k.effective_solution,
    k.prevention,
    (1 - (k.summary_embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.ai_learning_knowledge k
  WHERE k.summary_embedding IS NOT NULL
  ORDER BY k.summary_embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

COMMENT ON TABLE public.tickets IS 'Dossiers support client (chat)';
COMMENT ON TABLE public.ai_learning_knowledge IS 'Enseignements extraits à la clôture — accès service role uniquement';

-- Réindexation complète du RAG code (appel RPC avec clé service uniquement)
CREATE OR REPLACE FUNCTION public.admin_truncate_code_kb()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE public.code_kb_chunks;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_truncate_code_kb() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_truncate_code_kb() TO service_role;
