-- Permet le filtre des analyses hebdomadaires par établissement.
-- establishment_id = null → principal / agrégé (un seul par semaine).
-- establishment_id = uuid → insight pour cet établissement.

ALTER TABLE public.weekly_insights
  ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE;

-- Remplacer l'ancien unique par des index partiels.
-- DROP CONSTRAINT retire aussi l'index associé (pas de DROP INDEX séparé).
ALTER TABLE public.weekly_insights
  DROP CONSTRAINT IF EXISTS weekly_insights_user_id_week_start_key;

-- Un seul "agrégé" (establishment_id null) par user/week
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_insights_group
  ON public.weekly_insights (user_id, week_start) WHERE establishment_id IS NULL;

-- Un insight par établissement par user/week
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_insights_per_est
  ON public.weekly_insights (user_id, week_start, establishment_id) WHERE establishment_id IS NOT NULL;

-- Les lignes existantes gardent establishment_id = null.
