-- Bons d'achat fidélité (points) : traçabilité, usage unique, expiration optionnelle

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_reward_kind TEXT NOT NULL DEFAULT 'label_only'
    CHECK (banano_loyalty_voucher_reward_kind IN ('label_only', 'percent', 'fixed_euro')),
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_reward_percent NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (
      banano_loyalty_voucher_reward_percent >= 0::numeric
      AND banano_loyalty_voucher_reward_percent <= 100::numeric
    ),
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_reward_euro_cents INT NOT NULL DEFAULT 0
    CHECK (banano_loyalty_voucher_reward_euro_cents >= 0),
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_validity_days INT NULL
    CHECK (
      banano_loyalty_voucher_validity_days IS NULL
      OR (
        banano_loyalty_voucher_validity_days >= 1
        AND banano_loyalty_voucher_validity_days <= 3650
      )
    ),
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.banano_loyalty_voucher_reward_kind IS
  'Contenu du bon au seuil : libellé seul, pourcentage, ou montant fixe (les deux derniers enrichissent le libellé).';
COMMENT ON COLUMN public.profiles.banano_loyalty_voucher_reward_percent IS
  'Si reward_kind=percent : valeur % affichée sur le bon (ex. 5 = 5%).';
COMMENT ON COLUMN public.profiles.banano_loyalty_voucher_reward_euro_cents IS
  'Si reward_kind=fixed_euro : montant en centimes (ex. 500 = 5,00 €).';
COMMENT ON COLUMN public.profiles.banano_loyalty_voucher_validity_days IS
  'Durée de validité après émission (NULL = pas d’expiration).';
COMMENT ON COLUMN public.profiles.banano_loyalty_voucher_whatsapp_enabled IS
  'Si true : envoi WhatsApp au client à la création d’un bon (numéro requis).';

CREATE TABLE IF NOT EXISTS public.banano_loyalty_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.banano_loyalty_members (id) ON DELETE CASCADE,
  public_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'redeemed', 'expired')),
  reward_kind TEXT NOT NULL
    CHECK (reward_kind IN ('label_only', 'percent', 'fixed_euro')),
  reward_percent NUMERIC(7, 4),
  reward_euro_cents INT,
  reward_label TEXT NOT NULL,
  threshold_snapshot INT NOT NULL CHECK (threshold_snapshot >= 1),
  points_balance_after INT NOT NULL CHECK (points_balance_after >= 0),
  earn_event_id UUID REFERENCES public.banano_loyalty_events (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_by_staff_id UUID REFERENCES public.banano_terminal_staff (id) ON DELETE SET NULL,
  UNIQUE (public_code)
);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_vouchers_user_member_created
  ON public.banano_loyalty_vouchers (user_id, member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_vouchers_user_status
  ON public.banano_loyalty_vouchers (user_id, status);

ALTER TABLE public.banano_loyalty_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_loyalty_vouchers_select_own" ON public.banano_loyalty_vouchers;
CREATE POLICY "banano_loyalty_vouchers_select_own"
  ON public.banano_loyalty_vouchers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_vouchers_insert_own" ON public.banano_loyalty_vouchers;
CREATE POLICY "banano_loyalty_vouchers_insert_own"
  ON public.banano_loyalty_vouchers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_vouchers_update_own" ON public.banano_loyalty_vouchers;
CREATE POLICY "banano_loyalty_vouchers_update_own"
  ON public.banano_loyalty_vouchers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
    'voucher_redeemed'
  ));
