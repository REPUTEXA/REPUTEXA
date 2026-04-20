-- Défi REPUTEXA : campagne configurable par marchand (dates, message concours, récompenses, mots-clés).

CREATE TABLE IF NOT EXISTS public.reputexa_challenge_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Défi REPUTEXA',
  is_active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  competition_message TEXT NOT NULL DEFAULT '',
  reward_description TEXT NOT NULL DEFAULT '',
  bonus_keywords TEXT[] NOT NULL DEFAULT '{}',
  tracked_employee_names TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reputexa_challenge_dates_ok CHECK (
    ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reputexa_challenge_campaigns_user
  ON public.reputexa_challenge_campaigns (user_id);

CREATE INDEX IF NOT EXISTS idx_reputexa_challenge_active
  ON public.reputexa_challenge_campaigns (user_id)
  WHERE is_active = true;

ALTER TABLE public.reputexa_challenge_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reputexa_challenge_select_own" ON public.reputexa_challenge_campaigns;
CREATE POLICY "reputexa_challenge_select_own"
  ON public.reputexa_challenge_campaigns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_challenge_insert_own" ON public.reputexa_challenge_campaigns;
CREATE POLICY "reputexa_challenge_insert_own"
  ON public.reputexa_challenge_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_challenge_update_own" ON public.reputexa_challenge_campaigns;
CREATE POLICY "reputexa_challenge_update_own"
  ON public.reputexa_challenge_campaigns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_challenge_delete_own" ON public.reputexa_challenge_campaigns;
CREATE POLICY "reputexa_challenge_delete_own"
  ON public.reputexa_challenge_campaigns FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_reputexa_challenge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reputexa_challenge_campaigns_updated_at ON public.reputexa_challenge_campaigns;
CREATE TRIGGER reputexa_challenge_campaigns_updated_at
  BEFORE UPDATE ON public.reputexa_challenge_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_reputexa_challenge_updated_at();

COMMENT ON TABLE public.reputexa_challenge_campaigns IS 'Campagne « Défi REPUTEXA » : période, message WhatsApp additionnel, barème, employés suivis.';
