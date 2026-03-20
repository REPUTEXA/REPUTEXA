-- Migration 065 : Conversation state machine pour le flux NLU WhatsApp
ALTER TABLE public.review_queue
  ADD COLUMN IF NOT EXISTS conversation_state TEXT DEFAULT NULL;

-- États possibles :
--   NULL              → état initial / message envoyé, pas encore de réponse
--   'awaiting_review' → client a répondu "1", on attend son texte brut
--   'review_generated'→ IA a poli l'avis, interactive buttons envoyés, en attente confirmation
--   'published'       → client a cliqué "Publier", lien Google envoyé

COMMENT ON COLUMN public.review_queue.conversation_state IS
  'État de la conversation NLU WhatsApp : NULL | awaiting_review | review_generated | published';

-- Index pour retrouver rapidement les conversations en cours
CREATE INDEX IF NOT EXISTS idx_review_queue_conversation_state
  ON public.review_queue (phone, conversation_state)
  WHERE conversation_state IS NOT NULL;
