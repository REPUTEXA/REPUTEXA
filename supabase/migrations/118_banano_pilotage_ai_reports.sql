-- Rapports PDF performance Banano + objectif CA mensuel

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_pilotage_monthly_revenue_goal_cents INT
  CHECK (
    banano_pilotage_monthly_revenue_goal_cents IS NULL
    OR (
      banano_pilotage_monthly_revenue_goal_cents >= 0
      AND banano_pilotage_monthly_revenue_goal_cents <= 1000000000
    )
  );

COMMENT ON COLUMN public.profiles.banano_pilotage_monthly_revenue_goal_cents IS
  'Objectif chiffre d''affaires TTC du mois en cours (centimes), pilotage Banano.';

CREATE TABLE IF NOT EXISTS public.banano_pilotage_performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  storage_path TEXT NOT NULL,
  ai_badge TEXT NOT NULL DEFAULT '',
  ai_headline TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_banano_pilotage_reports_user_month
  ON public.banano_pilotage_performance_reports (user_id, month_start DESC);

COMMENT ON TABLE public.banano_pilotage_performance_reports IS
  'Métadonnées des rapports PDF « performance IA » Banano (fichier dans storage).';

ALTER TABLE public.banano_pilotage_performance_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_pilotage_reports_select_own" ON public.banano_pilotage_performance_reports;
CREATE POLICY "banano_pilotage_reports_select_own"
  ON public.banano_pilotage_performance_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_pilotage_reports_insert_own" ON public.banano_pilotage_performance_reports;
CREATE POLICY "banano_pilotage_reports_insert_own"
  ON public.banano_pilotage_performance_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_pilotage_reports_update_own" ON public.banano_pilotage_performance_reports;
CREATE POLICY "banano_pilotage_reports_update_own"
  ON public.banano_pilotage_performance_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_pilotage_reports_delete_own" ON public.banano_pilotage_performance_reports;
CREATE POLICY "banano_pilotage_reports_delete_own"
  ON public.banano_pilotage_performance_reports FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banano-pilotage-reports',
  'banano-pilotage-reports',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "banano_pilotage_reports_service_upload" ON storage.objects;
CREATE POLICY "banano_pilotage_reports_service_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'banano-pilotage-reports');

DROP POLICY IF EXISTS "banano_pilotage_reports_user_read" ON storage.objects;
CREATE POLICY "banano_pilotage_reports_user_read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'banano-pilotage-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
