-- Multi-caisses (sync) + appairage tickets / scans Wallet (terminal_id).

ALTER TABLE public.banano_cash_ingestions
  ADD COLUMN IF NOT EXISTS terminal_id TEXT,
  ADD COLUMN IF NOT EXISTS staff_name TEXT,
  ADD COLUMN IF NOT EXISTS ticket_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matched_member_id UUID REFERENCES public.banano_loyalty_members (id) ON DELETE SET NULL;

UPDATE public.banano_cash_ingestions
SET ticket_at = created_at
WHERE ticket_at IS NULL;

ALTER TABLE public.banano_cash_ingestions
  ALTER COLUMN ticket_at SET DEFAULT now();

ALTER TABLE public.banano_cash_ingestions
  ALTER COLUMN ticket_at SET NOT NULL;

COMMENT ON COLUMN public.banano_cash_ingestions.terminal_id IS
  'Identifiant caisse (agent sync ou terminal web) pour ventilation pilotage et matching Wallet.';
COMMENT ON COLUMN public.banano_cash_ingestions.staff_name IS
  'Nom équipier saisi à la prise de poste (agent sync).';
COMMENT ON COLUMN public.banano_cash_ingestions.ticket_at IS
  'Horodatage métier du ticket (corps API) pour fenêtre de matching ±60 s.';
COMMENT ON COLUMN public.banano_cash_ingestions.matched_member_id IS
  'Membre Wallet rattaché automatiquement (scan même terminal dans la fenêtre).';

CREATE INDEX IF NOT EXISTS idx_banano_cash_ingestions_merchant_terminal_month
  ON public.banano_cash_ingestions (merchant_id, terminal_id, ticket_at DESC);

CREATE INDEX IF NOT EXISTS idx_banano_cash_ingestions_merchant_staff_ticket
  ON public.banano_cash_ingestions (merchant_id, staff_name, ticket_at DESC);

ALTER TABLE public.banano_loyalty_events
  ADD COLUMN IF NOT EXISTS terminal_id TEXT;

COMMENT ON COLUMN public.banano_loyalty_events.terminal_id IS
  'Caisse / poste : aligné sur terminal_id envoyé par l’agent sync pour réconciliation.';

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_events_user_terminal_created
  ON public.banano_loyalty_events (user_id, terminal_id, created_at DESC)
  WHERE terminal_id IS NOT NULL;
