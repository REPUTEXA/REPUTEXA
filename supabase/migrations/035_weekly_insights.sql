-- Weekly Insight (Fortune 500 style) pour Pulse/Zenith
-- Analyse hebdomadaire stockée par utilisateur et semaine

CREATE TABLE IF NOT EXISTS public.weekly_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  establishment_name TEXT NOT NULL DEFAULT '',
  avg_rating NUMERIC(3,2),
  total_reviews INT NOT NULL DEFAULT 0,
  top_section TEXT,
  watch_section TEXT,
  advice_section TEXT,
  full_report_json JSONB,
  trend_severity INT CHECK (trend_severity >= 0 AND trend_severity <= 100),
  whatsapp_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_insights_user_id ON public.weekly_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_insights_week_start ON public.weekly_insights(week_start DESC);

ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Weekly insights: lecture par propriétaire"
  ON public.weekly_insights FOR SELECT
  USING (auth.uid() = user_id);

-- Le serveur (service role) insère/met à jour via cron ; l'API peut upsert via l'utilisateur
CREATE POLICY "Weekly insights: insertion par propriétaire"
  ON public.weekly_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Weekly insights: mise à jour par propriétaire"
  ON public.weekly_insights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
