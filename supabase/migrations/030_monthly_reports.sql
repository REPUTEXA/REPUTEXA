-- REPUTEXA: Rapports mensuels IA (archives, insights, PDF)
CREATE TYPE report_type_enum AS ENUM ('VISION', 'PULSE', 'ZENITH');

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL CHECK (year >= 2020 AND year <= 2100),
  report_type report_type_enum NOT NULL DEFAULT 'VISION',
  pdf_url TEXT,
  summary_stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_monthly_reports_user_id ON public.monthly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_created_at ON public.monthly_reports(created_at DESC);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_reports_select_own"
  ON public.monthly_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "monthly_reports_insert_service"
  ON public.monthly_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "monthly_reports_update_service"
  ON public.monthly_reports FOR UPDATE
  USING (true)
  WITH CHECK (true);
