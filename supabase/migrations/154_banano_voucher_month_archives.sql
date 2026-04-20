-- Archives mensuelles CSV des bons (fidélité + collaborateurs), générées en fin de période (cron 1er du mois).

CREATE TABLE IF NOT EXISTS public.banano_loyalty_voucher_month_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  archive_kind TEXT NOT NULL
    CHECK (archive_kind IN ('loyalty_threshold', 'staff_allowance')),
  storage_path TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  summary_line TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_start, archive_kind)
);

CREATE INDEX IF NOT EXISTS idx_banano_voucher_month_archives_user_month
  ON public.banano_loyalty_voucher_month_archives (user_id, month_start DESC, archive_kind);

COMMENT ON TABLE public.banano_loyalty_voucher_month_archives IS
  'Métadonnées export CSV mensuel des bons (stockage bucket banano-voucher-month-archives).';

ALTER TABLE public.banano_loyalty_voucher_month_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_voucher_month_archives_select_own"
  ON public.banano_loyalty_voucher_month_archives;
CREATE POLICY "banano_voucher_month_archives_select_own"
  ON public.banano_loyalty_voucher_month_archives FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_voucher_month_archives_insert_own"
  ON public.banano_loyalty_voucher_month_archives;
CREATE POLICY "banano_voucher_month_archives_insert_own"
  ON public.banano_loyalty_voucher_month_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_voucher_month_archives_update_own"
  ON public.banano_loyalty_voucher_month_archives;
CREATE POLICY "banano_voucher_month_archives_update_own"
  ON public.banano_loyalty_voucher_month_archives FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_voucher_month_archives_delete_own"
  ON public.banano_loyalty_voucher_month_archives;
CREATE POLICY "banano_voucher_month_archives_delete_own"
  ON public.banano_loyalty_voucher_month_archives FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banano-voucher-month-archives',
  'banano-voucher-month-archives',
  false,
  5242880,
  ARRAY['text/csv', 'text/plain', 'application/csv']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "banano_voucher_month_archives_service_upload" ON storage.objects;
CREATE POLICY "banano_voucher_month_archives_service_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'banano-voucher-month-archives');

DROP POLICY IF EXISTS "banano_voucher_month_archives_user_read" ON storage.objects;
CREATE POLICY "banano_voucher_month_archives_user_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'banano-voucher-month-archives'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
