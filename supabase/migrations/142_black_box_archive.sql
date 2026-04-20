-- Black Box Archive : index léger des lots archivés (froid S3/R2), recherche admin, sans données lourdes en base.

CREATE TABLE IF NOT EXISTS public.black_box_archive_index (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind         TEXT NOT NULL,
  source_table        TEXT NOT NULL,
  occurred_at_min     TIMESTAMPTZ NOT NULL,
  occurred_at_max     TIMESTAMPTZ NOT NULL,
  row_count           INT NOT NULL CHECK (row_count >= 1),
  source_ids          UUID[] NOT NULL DEFAULT '{}',
  user_ids            UUID[] NOT NULL DEFAULT '{}',
  search_text         TEXT NOT NULL DEFAULT '',
  s3_bucket           TEXT NOT NULL,
  s3_key              TEXT NOT NULL,
  content_sha256      TEXT NOT NULL,
  gzip_bytes          BIGINT NOT NULL CHECK (gzip_bytes > 0),
  approx_plain_bytes  BIGINT NOT NULL DEFAULT 0,
  compression         TEXT NOT NULL DEFAULT 'gzip' CHECK (compression IN ('gzip', 'brotli')),
  hot_deleted         BOOLEAN NOT NULL DEFAULT false,
  ai_summary          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT black_box_archive_index_s3_unique UNIQUE (s3_bucket, s3_key),
  CONSTRAINT black_box_archive_index_dedupe UNIQUE (source_table, content_sha256)
);

CREATE INDEX IF NOT EXISTS idx_black_box_archive_created ON public.black_box_archive_index (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_black_box_archive_table_occurred
  ON public.black_box_archive_index (source_table, occurred_at_max DESC);
CREATE INDEX IF NOT EXISTS idx_black_box_archive_search ON public.black_box_archive_index
  USING gin (to_tsvector('simple', coalesce(search_text, '')));

CREATE TABLE IF NOT EXISTS public.black_box_archive_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  batches_written INT NOT NULL DEFAULT 0,
  rows_archived   INT NOT NULL DEFAULT 0,
  bytes_out       BIGINT NOT NULL DEFAULT 0,
  error_message   TEXT,
  detail          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_black_box_runs_started ON public.black_box_archive_runs (started_at DESC);

ALTER TABLE public.black_box_archive_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.black_box_archive_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "black_box_archive_index_no_client" ON public.black_box_archive_index;
CREATE POLICY "black_box_archive_index_no_client"
  ON public.black_box_archive_index FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "black_box_archive_runs_no_client" ON public.black_box_archive_runs;
CREATE POLICY "black_box_archive_runs_no_client"
  ON public.black_box_archive_runs FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.black_box_archive_index IS
  'Index Time Machine — lots compressés (gzip) sur stockage objet ; métadonnées pour recherche admin.';
COMMENT ON TABLE public.black_box_archive_runs IS
  'Journal des exécutions cron/script Black Box Archive.';

-- Curseur idempotent pour mirrors (ex. reviews) sans supprimer les lignes chaudes.
CREATE TABLE IF NOT EXISTS public.black_box_archive_watermark (
  source_table      TEXT PRIMARY KEY,
  last_archived_at  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.black_box_archive_watermark ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "black_box_watermark_no_client" ON public.black_box_archive_watermark;
CREATE POLICY "black_box_watermark_no_client"
  ON public.black_box_archive_watermark FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.black_box_archive_watermark IS
  'Frontière temporelle : dernier created_at inclus pour lots mirrors (pas de delete hot).';
