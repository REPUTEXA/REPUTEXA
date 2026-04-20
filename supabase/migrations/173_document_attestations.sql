-- Attestations de documents certifiés (sceau + QR / empreinte SHA-256).
-- Lecture/écriture côté application via service role ou routes serveur uniquement.

CREATE TABLE IF NOT EXISTS public.document_attestations (
  id uuid PRIMARY KEY,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  issuer_legal_name text NOT NULL,
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_attestations_created_at_idx
  ON public.document_attestations (created_at DESC);

COMMENT ON TABLE public.document_attestations IS 'Empreinte SHA-256 des PDF certifiés (sceau + QR) pour la page publique /verify/[id].';

ALTER TABLE public.document_attestations ENABLE ROW LEVEL SECURITY;
