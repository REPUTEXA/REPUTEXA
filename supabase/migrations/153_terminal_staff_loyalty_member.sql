-- Lien équipier terminal ↔ fiche client (compte CRM obligatoire pour les nouveaux ajouts via UI).

ALTER TABLE public.banano_terminal_staff
  ADD COLUMN IF NOT EXISTS loyalty_member_id UUID NULL
    REFERENCES public.banano_loyalty_members (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.banano_terminal_staff.loyalty_member_id IS
  'Fiche client à laquelle est rattaché l’équipier (PIN caisse).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_terminal_staff_user_loyalty_member
  ON public.banano_terminal_staff (user_id, loyalty_member_id)
  WHERE loyalty_member_id IS NOT NULL;

ALTER TABLE public.banano_loyalty_events
  DROP CONSTRAINT IF EXISTS banano_loyalty_events_event_type_check;

ALTER TABLE public.banano_loyalty_events
  ADD CONSTRAINT banano_loyalty_events_event_type_check CHECK (event_type IN (
    'earn_points',
    'redeem_points',
    'earn_stamps',
    'redeem_stamps',
    'encaisser_reward',
    'member_created',
    'voucher_issued',
    'voucher_redeemed',
    'staff_allowance_issued',
    'staff_allowance_debit',
    'staff_allowance_merchant_adjust'
  ));
