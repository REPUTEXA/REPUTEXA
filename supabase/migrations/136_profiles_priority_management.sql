-- Gestion par exception : priorisation clients (profiles) + historique usage IA pour sparklines.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS priority_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_priority_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS security_alert BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_llm_priority_prev_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_llm_priority_prev_at TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_priority_score_trilevel_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_priority_score_trilevel_check
  CHECK (priority_score IN (0, 50, 100));

COMMENT ON COLUMN public.profiles.priority_score IS
  '0 = normal, 50 = à surveiller (soft quota / pic), 100 = critique (hard quota, impayé, alerte sécu).';
COMMENT ON COLUMN public.profiles.security_alert IS
  'À activer manuellement ou via automation : priorise le client en critique (100).';

CREATE INDEX IF NOT EXISTS idx_profiles_priority_created
  ON public.profiles (priority_score DESC, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.ai_llm_usage_daily (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  call_total INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_usage_daily_user_recent
  ON public.ai_llm_usage_daily (user_id, usage_date DESC);

ALTER TABLE public.ai_llm_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_llm_usage_daily_select_own" ON public.ai_llm_usage_daily;
CREATE POLICY "ai_llm_usage_daily_select_own"
  ON public.ai_llm_usage_daily FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.ai_llm_usage_daily IS
  'Série quotidienne (UTC) des appels LLM pour admin sparkline — alimentée par le cron priorité.';

-- Recalcule priority_score (0 / 50 / 100), met à jour les clichés pour détection de pic au prochain passage.
CREATE OR REPLACE FUNCTION public.compute_priority_score()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET
    priority_score = v.score,
    last_priority_update = now()
  FROM (
    SELECT
      p2.id,
      CASE
        WHEN COALESCE(p2.security_alert, false) THEN 100
        WHEN lower(trim(COALESCE(p2.subscription_status, ''))) = 'past_due' THEN 100
        WHEN b.user_id IS NOT NULL AND b.call_count >= b.daily_hard_limit THEN 100
        WHEN b.user_id IS NOT NULL AND b.call_count > b.daily_soft_limit THEN 50
        WHEN b.user_id IS NOT NULL
          AND COALESCE(p2.ai_llm_priority_prev_count, 0) >= 1
          AND b.call_count >= CEIL(p2.ai_llm_priority_prev_count::numeric * 1.5)
          AND p2.ai_llm_priority_prev_at IS NOT NULL
          AND p2.ai_llm_priority_prev_at > (now() AT TIME ZONE 'utc') - interval '75 minutes'
        THEN 50
        ELSE 0
      END AS score
    FROM public.profiles p2
    LEFT JOIN public.ai_llm_usage_budget b ON b.user_id = p2.id
  ) v
  WHERE p.id = v.id;

  UPDATE public.profiles p
  SET
    ai_llm_priority_prev_count = COALESCE(b.call_count, 0),
    ai_llm_priority_prev_at = (now() AT TIME ZONE 'utc')
  FROM public.ai_llm_usage_budget b
  WHERE p.id = b.user_id;

  INSERT INTO public.ai_llm_usage_daily (user_id, usage_date, call_total, updated_at)
  SELECT
    b.user_id,
    ((now() AT TIME ZONE 'utc'))::date,
    b.call_count,
    now()
  FROM public.ai_llm_usage_budget b
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    call_total = GREATEST(ai_llm_usage_daily.call_total, EXCLUDED.call_total),
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.compute_priority_score IS
  'Priorise les profils : hard/soft IA, past_due, security_alert, pic ~50% / 75 min. Puis cliché + série du jour.';
