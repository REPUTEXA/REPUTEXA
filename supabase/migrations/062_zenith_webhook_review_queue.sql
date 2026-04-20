-- Migration 062 : Plan Zenith — Webhook token + File d'attente de sollicitation d'avis

-- 1. Colonne webhook_token sur profiles (unique par commerçant Zenith)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS webhook_token TEXT UNIQUE;

COMMENT ON COLUMN public.profiles.webhook_token IS
  'Token secret du commerçant Zenith pour authentifier les appels webhook entrants (POS, Zapier, etc.)';

-- 2. Table review_queue : file d'attente RGPD pour la sollicitation WhatsApp
CREATE TABLE IF NOT EXISTS public.review_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   TEXT        NOT NULL,
  phone        TEXT        NOT NULL,
  source_info  TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.review_queue IS
  'File d''attente de sollicitation d''avis Zenith. Chaque ligne = un client à contacter après 30 min.';
COMMENT ON COLUMN public.review_queue.metadata IS
  'RGPD : IP de l''appelant, téléphone brut reçu, horodatage de réception.';

-- Index pour le cron qui dépile la file (scheduled_at + status)
CREATE INDEX IF NOT EXISTS idx_review_queue_scheduled
  ON public.review_queue(user_id, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_review_queue_user_status
  ON public.review_queue(user_id, status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_review_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_queue_updated_at ON public.review_queue;
CREATE TRIGGER review_queue_updated_at
  BEFORE UPDATE ON public.review_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_review_queue_updated_at();

-- RLS
ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;

-- Le commerçant peut lire sa propre file
CREATE POLICY "review_queue_select_owner"
  ON public.review_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Le service admin (webhook) peut insérer (bypass RLS via service_role)
CREATE POLICY "review_queue_insert_service"
  ON public.review_queue FOR INSERT
  WITH CHECK (true);

-- Le service admin peut mettre à jour le statut (cron d'envoi)
CREATE POLICY "review_queue_update_service"
  ON public.review_queue FOR UPDATE
  USING (true);
