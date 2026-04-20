-- Journal des promos « Elite / Top clients » envoyées par le commerçant (audit, pas d’envoi auto).

CREATE TABLE IF NOT EXISTS public.banano_loyalty_elite_promo_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.banano_loyalty_members (id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  offer_text TEXT NOT NULL,
  full_message TEXT,
  whatsapp_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT banano_elite_month_key_chk CHECK (
    month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  CONSTRAINT banano_elite_offer_len_chk CHECK (char_length(offer_text) <= 4000),
  CONSTRAINT banano_elite_full_len_chk CHECK (full_message IS NULL OR char_length(full_message) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_banano_elite_promo_user_created
  ON public.banano_loyalty_elite_promo_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_banano_elite_promo_member
  ON public.banano_loyalty_elite_promo_log (member_id, created_at DESC);

COMMENT ON TABLE public.banano_loyalty_elite_promo_log IS
  'Envoi manuel de promos aux meilleurs clients fidélité (WhatsApp) — traçabilité.';

ALTER TABLE public.banano_loyalty_elite_promo_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_elite_promo_select_own" ON public.banano_loyalty_elite_promo_log;
CREATE POLICY "banano_elite_promo_select_own"
  ON public.banano_loyalty_elite_promo_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_elite_promo_insert_own" ON public.banano_loyalty_elite_promo_log;
CREATE POLICY "banano_elite_promo_insert_own"
  ON public.banano_loyalty_elite_promo_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
