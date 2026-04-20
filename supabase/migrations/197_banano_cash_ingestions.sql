-- Ingestions caisse (agent reputexa-sync, exports POS) pour pilotage et comparatif CA.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_pilotage_ingest_secret TEXT;

COMMENT ON COLUMN public.profiles.banano_pilotage_ingest_secret IS
  'Secret Bearer pour POST /api/banano/pilotage/ingest (même valeur que la clé saisie dans reputexa-sync).';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_banano_pilotage_ingest_secret_uniq
  ON public.profiles (banano_pilotage_ingest_secret)
  WHERE banano_pilotage_ingest_secret IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.banano_cash_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  amount NUMERIC(14, 4) NOT NULL,
  source TEXT NOT NULL DEFAULT 'reputexa-sync',
  raw_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_cash_ingestions_merchant_created
  ON public.banano_cash_ingestions (merchant_id, created_at DESC);

COMMENT ON TABLE public.banano_cash_ingestions IS
  'Tickets caisse ingérés (montant + contenu brut) pour le comparatif CA global vs fidélité Reputexa.';

ALTER TABLE public.banano_cash_ingestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_cash_ingestions_select_own" ON public.banano_cash_ingestions;
CREATE POLICY "banano_cash_ingestions_select_own"
  ON public.banano_cash_ingestions FOR SELECT
  USING (auth.uid() = merchant_id);
