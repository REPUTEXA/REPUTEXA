-- Migration 064 : Configuration Zenith Collecte d'Avis
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS webhook_send_delay_minutes INTEGER NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.profiles.webhook_send_delay_minutes IS
  'Délai en minutes entre la vente et l''envoi du message WhatsApp Zenith (30, 60, 120, 1440).';
