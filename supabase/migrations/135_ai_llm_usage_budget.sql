-- Garde-fou financier : volumétrie appels LLM par compte marchand (fenêtre jour UTC).
-- Incrément côté serveur (service role) ; lecture possible par le propriétaire (RLS).

CREATE TABLE IF NOT EXISTS public.ai_llm_usage_budget (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('day', now() AT TIME ZONE 'utc')),
  call_count INT NOT NULL DEFAULT 0,
  daily_soft_limit INT NOT NULL DEFAULT 400,
  daily_hard_limit INT NOT NULL DEFAULT 7000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_llm_usage_budget_period ON public.ai_llm_usage_budget (period_start);

ALTER TABLE public.ai_llm_usage_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_llm_usage_budget_select_own" ON public.ai_llm_usage_budget;
CREATE POLICY "ai_llm_usage_budget_select_own"
  ON public.ai_llm_usage_budget FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.ai_llm_usage_budget IS
  'Quota journalier (UTC) des appels LLM par marchand — soft = alerte/bridage, hard = refus 429.';
