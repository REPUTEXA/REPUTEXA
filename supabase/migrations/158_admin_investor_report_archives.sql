-- Archives PDF « data-room » investisseur — traçabilité admin (accès via API service role uniquement).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-investor-reports',
  'admin-investor-reports',
  false,
  20971520,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_investor_report_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  metrics_generated_at TIMESTAMPTZ,
  byte_size INT NOT NULL CHECK (byte_size > 0),
  content_sha256 TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_investor_reports_created
  ON public.admin_investor_report_archives (created_at DESC);

ALTER TABLE public.admin_investor_report_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_investor_report_archives_no_client" ON public.admin_investor_report_archives;
CREATE POLICY "admin_investor_report_archives_no_client"
  ON public.admin_investor_report_archives FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.admin_investor_report_archives IS
  'Historique des exports PDF Investor / data-room. Lecture et écriture réservées au backend (clé service).';
