-- Migration 074 : Centre de Conformité Intelligent (Legal-AI)
-- Ajout : status (PENDING/ACTIVE/ARCHIVED), embedding vectoriel, workflow RAG légal

-- 1. Colonne status
ALTER TABLE public.legal_versioning
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('PENDING', 'ACTIVE', 'ARCHIVED'));

COMMENT ON COLUMN public.legal_versioning.status IS
  'Statut du document : PENDING (date future, pas encore en vigueur), ACTIVE (en vigueur), ARCHIVED.';

-- 2. Colonne embedding RAG (vector 1536 = text-embedding-3-small)
ALTER TABLE public.legal_versioning
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

COMMENT ON COLUMN public.legal_versioning.embedding IS
  'Embedding vectoriel du contenu pour le RAG du support IA.';

-- 3. Backfill : les entrées existantes avec date future → PENDING
UPDATE public.legal_versioning
  SET status = 'PENDING'
  WHERE effective_date > CURRENT_DATE AND status = 'ACTIVE';

-- 4. Index pour les requêtes rapides par statut
CREATE INDEX IF NOT EXISTS idx_legal_versioning_status
  ON public.legal_versioning (status, document_type, version DESC);

-- 5. Fonction RAG : recherche sémantique dans les documents légaux (pour le support IA)
CREATE OR REPLACE FUNCTION match_legal_documents(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  document_type text,
  version     int,
  content     text,
  summary_of_changes text,
  effective_date date,
  status      text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    lv.id,
    lv.document_type,
    lv.version,
    lv.content,
    lv.summary_of_changes,
    lv.effective_date,
    lv.status,
    1 - (lv.embedding <=> query_embedding) AS similarity
  FROM public.legal_versioning lv
  WHERE lv.embedding IS NOT NULL
  ORDER BY lv.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 6. Fonction de passage automatique PENDING → ACTIVE (appelable via cron ou à l'ouverture du dashboard)
CREATE OR REPLACE FUNCTION activate_pending_legal_documents()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.legal_versioning
    SET status = 'ACTIVE'
    WHERE status = 'PENDING'
      AND effective_date <= CURRENT_DATE;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION activate_pending_legal_documents IS
  'Active automatiquement les documents légaux dont la date d''entrée en vigueur est passée. Appeler via pg_cron ou au chargement admin.';
