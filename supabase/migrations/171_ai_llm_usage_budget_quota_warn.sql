-- Une alerte e-mail max par jour UTC lorsque le volume approche le plafond dur (quota IA).

ALTER TABLE public.ai_llm_usage_budget
  ADD COLUMN IF NOT EXISTS quota_warn_utc_day text;

COMMENT ON COLUMN public.ai_llm_usage_budget.quota_warn_utc_day IS
  'Date UTC (YYYY-MM-DD) pour laquelle l''alerte quota IA a déjà été envoyée.';
