-- Omni-Synapse : mémoire sémantique unifiée (interactions → embeddings) + rétroaction récursive
CREATE EXTENSION IF NOT EXISTS vector;

-- Canaux d'ingestion unifiée (WhatsApp, Stripe, Google, L’Addition, autre)
CREATE TABLE IF NOT EXISTS public.omni_interaction_memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id  UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  channel           TEXT NOT NULL CHECK (
    channel IN ('whatsapp', 'stripe', 'google', 'addition', 'other')
  ),
  canonical_text    TEXT NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding         vector(1536),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.omni_interaction_memories IS
  'Omni-Synapse — Protocole de Perception : chaque interaction métier vectorisée (text-embedding-3-small) pour recherche sémantique.';

CREATE INDEX IF NOT EXISTS idx_omni_memories_user_created
  ON public.omni_interaction_memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_omni_memories_embedding_hnsw
  ON public.omni_interaction_memories
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

ALTER TABLE public.omni_interaction_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "omni_memories_select_owner"
  ON public.omni_interaction_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "omni_memories_insert_owner"
  ON public.omni_interaction_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "omni_memories_delete_owner"
  ON public.omni_interaction_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Suivi 48h post-envoi (collecte avis / publication) — worker Edge
CREATE TABLE IF NOT EXISTS public.omni_publication_followups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_queue_id   UUID NOT NULL REFERENCES public.review_queue(id) ON DELETE CASCADE,
  due_at            TIMESTAMPTZ NOT NULL,
  processed_at      TIMESTAMPTZ,
  outcome           TEXT NOT NULL DEFAULT 'pending'
    CHECK (outcome IN ('pending', 'published', 'not_published', 'unknown')),
  failure_analysis  JSONB,
  prompt_delta      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.omni_publication_followups IS
  'Omni-Synapse — Protocole de Rétroaction : scan J+2 après envoi review_queue, apprentissage prompt.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_omni_followup_queue
  ON public.omni_publication_followups (review_queue_id);

CREATE INDEX IF NOT EXISTS idx_omni_followup_due_pending
  ON public.omni_publication_followups (due_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.omni_publication_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "omni_followups_select_owner"
  ON public.omni_publication_followups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "omni_followups_insert_owner"
  ON public.omni_publication_followups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "omni_followups_update_owner"
  ON public.omni_publication_followups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Addon prompt récursif (concaténé aux instructions système génération)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS omni_recursive_prompt_addon TEXT DEFAULT '';

COMMENT ON COLUMN public.profiles.omni_recursive_prompt_addon IS
 'Omni-Synapse : fragments appris après échecs de publication (worker J+2).';

-- Recherche sémantique isolée par commerçant
CREATE OR REPLACE FUNCTION public.match_omni_interaction_memories(
  query_embedding vector(1536),
  filter_user_id UUID,
  match_count INT DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  channel TEXT,
  canonical_text TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    m.id,
    m.channel,
    m.canonical_text,
    m.metadata,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.omni_interaction_memories m
  WHERE m.embedding IS NOT NULL
    AND m.user_id = filter_user_id
  ORDER BY m.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 32);
$$;

COMMENT ON FUNCTION public.match_omni_interaction_memories IS
  'RPC pgvector : requêtes type « clients mécontents du service mais fans de la terrasse ».';

GRANT EXECUTE ON FUNCTION public.match_omni_interaction_memories(vector(1536), UUID, INT)
  TO authenticated, service_role;
