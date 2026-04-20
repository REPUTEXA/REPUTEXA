-- File d'envoi WhatsApp manuel Banano (programmation hors flux Zenith / automation).

CREATE TABLE IF NOT EXISTS public.banano_merchant_manual_whatsapp_outbox (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id     UUID        REFERENCES public.banano_loyalty_members(id) ON DELETE SET NULL,
  phone_e164    TEXT        NOT NULL,
  body          TEXT        NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 4000),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at       TIMESTAMPTZ,
  error         TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.banano_merchant_manual_whatsapp_outbox IS
  'Messages WhatsApp rédigés depuis la base clients Banano ; dépilage par cron (service role).';
COMMENT ON COLUMN public.banano_merchant_manual_whatsapp_outbox.metadata IS
  'Ex. message_id Twilio, commerce_name (optionnel).';

CREATE INDEX IF NOT EXISTS idx_banano_manual_wa_outbox_pending
  ON public.banano_merchant_manual_whatsapp_outbox (scheduled_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_banano_manual_wa_outbox_user
  ON public.banano_merchant_manual_whatsapp_outbox (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_banano_manual_wa_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banano_manual_wa_outbox_updated_at
  ON public.banano_merchant_manual_whatsapp_outbox;
CREATE TRIGGER banano_manual_wa_outbox_updated_at
  BEFORE UPDATE ON public.banano_merchant_manual_whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_banano_manual_wa_outbox_updated_at();

ALTER TABLE public.banano_merchant_manual_whatsapp_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_manual_wa_outbox_select_own"
  ON public.banano_merchant_manual_whatsapp_outbox;
CREATE POLICY "banano_manual_wa_outbox_select_own"
  ON public.banano_merchant_manual_whatsapp_outbox FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_manual_wa_outbox_insert_own"
  ON public.banano_merchant_manual_whatsapp_outbox;
CREATE POLICY "banano_manual_wa_outbox_insert_own"
  ON public.banano_merchant_manual_whatsapp_outbox FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_manual_wa_outbox_update_own_pending"
  ON public.banano_merchant_manual_whatsapp_outbox;
CREATE POLICY "banano_manual_wa_outbox_update_own_pending"
  ON public.banano_merchant_manual_whatsapp_outbox FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id);
