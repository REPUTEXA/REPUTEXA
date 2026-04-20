-- Idempotence des opérations terminal (rejeu sync après coupure réseau)

CREATE TABLE IF NOT EXISTS public.banano_loyalty_transact_idempotency (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('transact', 'voucher_redeem')),
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_transact_idem_user_created
  ON public.banano_loyalty_transact_idempotency (user_id, created_at DESC);

COMMENT ON TABLE public.banano_loyalty_transact_idempotency IS
  'Réponses API mémorisées par clé client pour éviter double application au rejeu (mode dégradé terminal).';

ALTER TABLE public.banano_loyalty_transact_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_loyalty_transact_idem_select_own"
  ON public.banano_loyalty_transact_idempotency;
CREATE POLICY "banano_loyalty_transact_idem_select_own"
  ON public.banano_loyalty_transact_idempotency FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_transact_idem_insert_own"
  ON public.banano_loyalty_transact_idempotency;
CREATE POLICY "banano_loyalty_transact_idem_insert_own"
  ON public.banano_loyalty_transact_idempotency FOR INSERT
  WITH CHECK (auth.uid() = user_id);
