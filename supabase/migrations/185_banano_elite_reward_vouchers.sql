-- Elite "Top Clients" : bons € + métadonnées mois de classement

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'banano_loyalty_vouchers'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%voucher_class%'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.banano_loyalty_vouchers DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.banano_loyalty_vouchers
  ADD CONSTRAINT banano_loyalty_vouchers_voucher_class_check CHECK (
    voucher_class IN ('loyalty_threshold', 'staff_allowance', 'elite_reward')
  );

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS elite_promo_month_key TEXT NULL;

COMMENT ON COLUMN public.banano_loyalty_vouchers.voucher_class IS
  'loyalty_threshold = bon seuil ; staff_allowance = solde € collaborateur ; elite_reward = bon Top Clients (Champions).';

COMMENT ON COLUMN public.banano_loyalty_vouchers.metadata IS
  'JSON libre (ex. ranking_month pour elite_reward).';

COMMENT ON COLUMN public.banano_loyalty_vouchers.elite_promo_month_key IS
  'YYYY-MM : idempotence d''un bon Elite par membre et par mois de classement.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_voucher_elite_month_user_member
  ON public.banano_loyalty_vouchers (user_id, member_id, elite_promo_month_key)
  WHERE
    voucher_class = 'elite_reward'
    AND elite_promo_month_key IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_elite_reward_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_elite_reward_euro_cents INT NOT NULL DEFAULT 0
    CHECK (
      banano_elite_reward_euro_cents >= 0
      AND banano_elite_reward_euro_cents <= 100000000
    );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_elite_reward_whatsapp_template TEXT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_elite_reward_validity_days INT NULL
    CHECK (
      banano_elite_reward_validity_days IS NULL
      OR (
        banano_elite_reward_validity_days >= 1
        AND banano_elite_reward_validity_days <= 3650
      )
    );

COMMENT ON COLUMN public.profiles.banano_elite_reward_enabled IS
  'Si true : envoi promo Elite crée un bon € (montant par défaut) avant WhatsApp.';

COMMENT ON COLUMN public.profiles.banano_elite_reward_euro_cents IS
  'Montant du bon Elite Top Clients (centimes).';

COMMENT ON COLUMN public.profiles.banano_elite_reward_whatsapp_template IS
  'Gabarit WhatsApp Top Clients ; variables {customer_name} {reward_amount} {wallet_link} {offer_text} {establishment_name} {voucher_code} {month_key}.';

COMMENT ON COLUMN public.profiles.banano_elite_reward_validity_days IS
  'Validité du bon Elite après émission (NULL = sans limite).';
