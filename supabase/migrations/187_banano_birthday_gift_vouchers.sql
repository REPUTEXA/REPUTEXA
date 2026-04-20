-- Bons « cadeau anniversaire » (automation jour J) + idempotence par date d’occurrence

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
    voucher_class IN ('loyalty_threshold', 'staff_allowance', 'elite_reward', 'birthday_gift')
  );

ALTER TABLE public.banano_loyalty_vouchers
  ADD COLUMN IF NOT EXISTS birthday_gift_occurrence_key TEXT NULL;

COMMENT ON COLUMN public.banano_loyalty_vouchers.voucher_class IS
  'loyalty_threshold = bon seuil ; staff_allowance = solde € collaborateur ; elite_reward = bon Top Clients ; birthday_gift = cadeau automation anniversaire.';

COMMENT ON COLUMN public.banano_loyalty_vouchers.birthday_gift_occurrence_key IS
  'Date YYYY-MM-DD de l’anniversaire concerné (idempotence : un bon par membre et par occurrence).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_banano_voucher_birthday_occurrence_user_member
  ON public.banano_loyalty_vouchers (user_id, member_id, birthday_gift_occurrence_key)
  WHERE
    voucher_class = 'birthday_gift'
    AND birthday_gift_occurrence_key IS NOT NULL;
