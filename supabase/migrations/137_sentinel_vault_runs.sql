-- Sentinel Vault : historique des sauvegardes chiffrées hors-site (S3 / R2).

CREATE TABLE IF NOT EXISTS public.sentinel_vault_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL CHECK (status IN ('running', 'ok', 'failed')),
  s3_bucket           TEXT,
  s3_key_daily        TEXT,
  s3_key_monthly      TEXT,
  bytes_plain         BIGINT,
  bytes_gzip          BIGINT,
  bytes_encrypted     BIGINT,
  duration_ms         INT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_vault_runs_run_at ON public.sentinel_vault_runs (run_at DESC);

ALTER TABLE public.sentinel_vault_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sentinel_vault_runs_admin_only" ON public.sentinel_vault_runs;

CREATE POLICY "sentinel_vault_runs_admin_only"
  ON public.sentinel_vault_runs FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.sentinel_vault_runs IS
  'Runs du cron Sentinel Vault : dump logique Postgres, gzip, AES-256-GCM, upload objet hors-site.';

-- Accès : service_role / postgres pour le cron et la clé service (contournent RLS). Aucun accès client JWT utile (policies fermées).
GRANT ALL ON TABLE public.sentinel_vault_runs TO postgres;
GRANT ALL ON TABLE public.sentinel_vault_runs TO service_role;
