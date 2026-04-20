-- Heure précise d’entrée en vigueur (UTC) pour les documents légaux + planification des e-mails d’information

ALTER TABLE public.legal_versioning
  ADD COLUMN IF NOT EXISTS effective_at timestamptz;

UPDATE public.legal_versioning
SET effective_at = (effective_date::text || 'T00:00:00Z')::timestamptz
WHERE effective_at IS NULL;

ALTER TABLE public.legal_versioning
  ALTER COLUMN effective_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_versioning_effective_at
  ON public.legal_versioning (effective_at DESC);

COMMENT ON COLUMN public.legal_versioning.effective_at IS
  'Moment UTC d’entrée en vigueur (modale / contenu public). effective_date reste le jour calendaire (rapports).';

-- Diffusion « information » planifiée (pas de préavis 30 j — contrôle applicatif sur la fenêtre date/heure)
CREATE TABLE IF NOT EXISTS public.admin_broadcast_scheduled (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_fr        text        NOT NULL,
  html_fr           text        NOT NULL,
  fingerprint       text        NOT NULL,
  scheduled_at      timestamptz NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  sent_at           timestamptz,
  error_message     text,
  emails_sent       int,
  emails_failed     int,
  total_users       int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_broadcast_scheduled_pending
  ON public.admin_broadcast_scheduled (scheduled_at ASC)
  WHERE status = 'pending';

ALTER TABLE public.admin_broadcast_scheduled ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_broadcast_scheduled_no_client"
  ON public.admin_broadcast_scheduled FOR ALL
  USING (false) WITH CHECK (false);

COMMENT ON TABLE public.admin_broadcast_scheduled IS
  'Cron service_role : envoi différé des e-mails d’information (traduction par locale au moment du run).';
