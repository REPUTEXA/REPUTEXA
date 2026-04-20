-- Archives PDF « dossier conformité mensuel » — bucket privé + métadonnées (service role / API admin).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-compliance-bundles',
  'admin-compliance-bundles',
  false,
  26214400,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_compliance_bundle_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'cron' CHECK (source IN ('cron', 'manual')),
  period_year INT NOT NULL CHECK (period_year >= 2020 AND period_year <= 2100),
  period_month INT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  byte_size INT NOT NULL CHECK (byte_size > 0),
  content_sha256 TEXT NOT NULL,
  signed_by TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_compliance_bundles_created
  ON public.admin_compliance_bundle_archives (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_compliance_bundle_cron_month
  ON public.admin_compliance_bundle_archives (period_year, period_month)
  WHERE source = 'cron';

ALTER TABLE public.admin_compliance_bundle_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_compliance_bundle_archives_no_client" ON public.admin_compliance_bundle_archives;
CREATE POLICY "admin_compliance_bundle_archives_no_client"
  ON public.admin_compliance_bundle_archives FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.admin_compliance_bundle_archives IS
  'Historique PDF dossier conformité (registre, sous-traitants, fiche opérateur). Lecture/écriture via backend uniquement.';
