-- Pilote automatique Banano : relances WhatsApp + impact CA estimé

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN public.banano_loyalty_members.birth_date IS
  'Optionnel : jour/mois pour relance anniversaire (année ignorée si besoin).';

CREATE TABLE IF NOT EXISTS public.banano_loyalty_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('lost_client', 'birthday')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_type)
);

CREATE TABLE IF NOT EXISTS public.banano_loyalty_automation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.banano_loyalty_members(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  payload JSONB,
  estimated_revenue_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_auto_log_user_created
  ON public.banano_loyalty_automation_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_banano_auto_log_member_rule
  ON public.banano_loyalty_automation_log (member_id, rule_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.banano_loyalty_automation_monthly_stats (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start DATE NOT NULL,
  attributed_revenue_cents INT NOT NULL DEFAULT 0,
  sends_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month_start)
);

ALTER TABLE public.banano_loyalty_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banano_loyalty_automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banano_loyalty_automation_monthly_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_auto_rules_select" ON public.banano_loyalty_automation_rules;
CREATE POLICY "banano_auto_rules_select"
  ON public.banano_loyalty_automation_rules FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_rules_insert" ON public.banano_loyalty_automation_rules;
CREATE POLICY "banano_auto_rules_insert"
  ON public.banano_loyalty_automation_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_rules_update" ON public.banano_loyalty_automation_rules;
CREATE POLICY "banano_auto_rules_update"
  ON public.banano_loyalty_automation_rules FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_rules_delete" ON public.banano_loyalty_automation_rules;
CREATE POLICY "banano_auto_rules_delete"
  ON public.banano_loyalty_automation_rules FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_log_select" ON public.banano_loyalty_automation_log;
CREATE POLICY "banano_auto_log_select"
  ON public.banano_loyalty_automation_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_log_insert" ON public.banano_loyalty_automation_log;
CREATE POLICY "banano_auto_log_insert"
  ON public.banano_loyalty_automation_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_stats_select" ON public.banano_loyalty_automation_monthly_stats;
CREATE POLICY "banano_auto_stats_select"
  ON public.banano_loyalty_automation_monthly_stats FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_stats_insert" ON public.banano_loyalty_automation_monthly_stats;
CREATE POLICY "banano_auto_stats_insert"
  ON public.banano_loyalty_automation_monthly_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_auto_stats_update" ON public.banano_loyalty_automation_monthly_stats;
CREATE POLICY "banano_auto_stats_update"
  ON public.banano_loyalty_automation_monthly_stats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
