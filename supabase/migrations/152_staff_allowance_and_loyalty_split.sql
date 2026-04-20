-- Programme tampons : réglages indépendants du programme points (seuil, libellé, bon).
-- Bons collaborateurs : solde dégressif (1 bon / mois / bénéficiaire), rôle CRM & opt-in.

-- A) Tampons : colonnes miroir (backfill depuis colonnes points / fidélité existantes)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_threshold_stamps INT
    CHECK (
      banano_loyalty_threshold_stamps IS NULL
      OR (
        banano_loyalty_threshold_stamps >= 1
        AND banano_loyalty_threshold_stamps <= 1000000
      )
    );

UPDATE public.profiles
SET
  banano_loyalty_threshold_stamps = banano_loyalty_threshold
WHERE
  banano_loyalty_threshold_stamps IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_threshold_stamps SET DEFAULT 200;

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_threshold_stamps SET NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_reward_text_stamps TEXT;

UPDATE public.profiles
SET
  banano_loyalty_reward_text_stamps = banano_loyalty_reward_text
WHERE
  banano_loyalty_reward_text_stamps IS NULL
  OR trim(COALESCE(banano_loyalty_reward_text_stamps, '')) = '';

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_reward_text_stamps SET DEFAULT '';

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_reward_text_stamps SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS banano_loyalty_voucher_stamps_reward_kind_chk;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_stamps_reward_kind TEXT;

UPDATE public.profiles
SET
  banano_loyalty_voucher_stamps_reward_kind = banano_loyalty_voucher_reward_kind
WHERE
  banano_loyalty_voucher_stamps_reward_kind IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_voucher_stamps_reward_kind SET DEFAULT 'label_only';

UPDATE public.profiles
SET
  banano_loyalty_voucher_stamps_reward_kind = 'label_only'
WHERE
  banano_loyalty_voucher_stamps_reward_kind IS NULL
  OR banano_loyalty_voucher_stamps_reward_kind NOT IN ('label_only', 'percent', 'fixed_euro');

ALTER TABLE public.profiles
  ADD CONSTRAINT banano_loyalty_voucher_stamps_reward_kind_chk CHECK (
    banano_loyalty_voucher_stamps_reward_kind IN ('label_only', 'percent', 'fixed_euro')
  )
  NOT valid;

ALTER TABLE public.profiles VALIDATE CONSTRAINT banano_loyalty_voucher_stamps_reward_kind_chk;

ALTER TABLE public.profiles
  ALTER COLUMN banano_loyalty_voucher_stamps_reward_kind SET NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_stamps_reward_percent NUMERIC(7, 4) NOT NULL DEFAULT 0
    CHECK (
      banano_loyalty_voucher_stamps_reward_percent >= 0::numeric
      AND banano_loyalty_voucher_stamps_reward_percent <= 100::numeric
    );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_stamps_reward_euro_cents INT NOT NULL DEFAULT 0
    CHECK (banano_loyalty_voucher_stamps_reward_euro_cents >= 0);

UPDATE public.profiles
SET
  banano_loyalty_voucher_stamps_reward_percent = banano_loyalty_voucher_reward_percent,
  banano_loyalty_voucher_stamps_reward_euro_cents = banano_loyalty_voucher_reward_euro_cents;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_stamps_validity_days INT NULL
    CHECK (
      banano_loyalty_voucher_stamps_validity_days IS NULL
      OR (
        banano_loyalty_voucher_stamps_validity_days >= 1
        AND banano_loyalty_voucher_stamps_validity_days <= 3650
      )
    );

UPDATE public.profiles
SET
  banano_loyalty_voucher_stamps_validity_days = banano_loyalty_voucher_validity_days
WHERE
  banano_loyalty_voucher_stamps_validity_days IS NULL
  AND banano_loyalty_voucher_validity_days IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_loyalty_voucher_stamps_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE public.profiles
SET
  banano_loyalty_voucher_stamps_whatsapp_enabled = banano_loyalty_voucher_whatsapp_enabled
WHERE
  banano_loyalty_voucher_stamps_whatsapp_enabled IS NOT true
  AND banano_loyalty_voucher_whatsapp_enabled IS true;

-- B) Avantages collaborateurs (paramètres globaux enseigne)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_staff_allowance_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_staff_allowance_monthly_euro_cents INT NOT NULL DEFAULT 0
    CHECK (
      banano_staff_allowance_monthly_euro_cents >= 0
      AND banano_staff_allowance_monthly_euro_cents <= 100000000
    );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_staff_allowance_validity_days INT NULL
    CHECK (
      banano_staff_allowance_validity_days IS NULL
      OR (
        banano_staff_allowance_validity_days >= 1
        AND banano_staff_allowance_validity_days <= 3650
      )
    );

COMMENT ON COLUMN public.profiles.banano_staff_allowance_enabled IS
  'Si true : génération mensuelle de bons collaborateurs pour les fiches opt-in (montant ci-dessous).';
COMMENT ON COLUMN public.profiles.banano_staff_allowance_monthly_euro_cents IS
  'Montant chargé chaque mois sur chaque bon collaborateur (centimes).';
COMMENT ON COLUMN public.profiles.banano_staff_allowance_validity_days IS
  'Durée après émission du bon mensuel ; NULL = pas d’expiration.';

-- C) Fiches CRM : rôle affichage + éligibilité bon mensuel

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS crm_role TEXT NOT NULL DEFAULT 'customer'
    CHECK (crm_role IN ('customer', 'staff'));

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS receives_staff_allowance BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.banano_loyalty_members.crm_role IS
  'customer = client ; staff = employé (badge CRM / terminal).';
COMMENT ON COLUMN public.banano_loyalty_members.receives_staff_allowance IS
  'Si true et module activé : 1 bon dégressif / mois calendaire.';

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_user_staff_allowance
  ON public.banano_loyalty_members (user_id, receives_staff_allowance)
  WHERE receives_staff_allowance IS true;

-- D) Bons : classe + solde euro (dégressif)

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS voucher_class TEXT NOT NULL DEFAULT 'loyalty_threshold'
    CHECK (voucher_class IN ('loyalty_threshold', 'staff_allowance'));

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS initial_euro_cents INT NULL
    CHECK (
      initial_euro_cents IS NULL
      OR (
        initial_euro_cents >= 0
        AND initial_euro_cents <= 100000000
      )
    );

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS remaining_euro_cents INT NULL
    CHECK (
      remaining_euro_cents IS NULL
      OR (
        remaining_euro_cents >= 0
        AND remaining_euro_cents <= 100000000
      )
    );

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS allowance_month_key TEXT NULL;

COMMENT ON COLUMN public.banano_loyalty_vouchers.voucher_class IS
  'loyalty_threshold = bon seuil points/tampons usage unique ; staff_allowance = solde € dégressif.';
COMMENT ON COLUMN public.banano_loyalty_vouchers.allowance_month_key IS
  'Période YYYY-MM pour idempotence du bon mensuel collaborateur.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_voucher_staff_month_user_member
  ON public.banano_loyalty_vouchers (user_id, member_id, allowance_month_key)
  WHERE
    voucher_class = 'staff_allowance'
    AND allowance_month_key IS NOT NULL;

-- issuer_unit : ajouter staff pour bons collaborateurs

ALTER TABLE public.banano_loyalty_vouchers
  DROP CONSTRAINT IF EXISTS banano_loyalty_vouchers_issuer_unit_check;

ALTER TABLE public.banano_loyalty_vouchers
  ADD CONSTRAINT banano_loyalty_vouchers_issuer_unit_check CHECK (
    issuer_unit IN ('points', 'stamps', 'staff')
  );

-- Événements fidélité

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
    'staff_allowance_debit'
  ));
