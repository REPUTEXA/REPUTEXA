-- Journal des consentements WhatsApp (preuve RGPD — oui / non / stop)
-- Les numéros sont stockés en empreinte SHA-256 uniquement.

CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  review_queue_id UUID REFERENCES public.review_queue(id) ON DELETE SET NULL,
  phone_hash TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('yes', 'no', 'stop')),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  message_preview TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_logs_merchant_created
  ON public.consent_logs (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consent_logs_phone_hash
  ON public.consent_logs (phone_hash);

COMMENT ON TABLE public.consent_logs IS 'Traces d''opt-in / refus / STOP WhatsApp pour audit RGPD (téléphone en hash SHA-256).';

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

-- Le commerçant lit uniquement ses lignes
CREATE POLICY consent_logs_select_own ON public.consent_logs
  FOR SELECT TO authenticated
  USING (merchant_id = auth.uid());

-- Insertion réservée au service role (webhooks serveur) — pas d''INSERT client direct
-- (le client passe par l''API si besoin ; par défaut aucune policy INSERT pour authenticated)

GRANT SELECT ON public.consent_logs TO authenticated;
