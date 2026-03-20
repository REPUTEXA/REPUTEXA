-- Migration 063 : Ajout de sent_at sur review_queue (horodatage d'envoi réel)
ALTER TABLE public.review_queue
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.review_queue.sent_at IS
  'Horodatage UTC de l''envoi effectif du message WhatsApp. NULL tant que status != sent.';
