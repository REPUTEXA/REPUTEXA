-- Mapping pour associer les callbacks WhatsApp (bouton) au review
-- Quand l'utilisateur tape "Approuver" ou "Modifier", on récupère review_id via to_phone
CREATE TABLE IF NOT EXISTS public.whatsapp_outbound_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone TEXT NOT NULL,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  twilio_message_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_to_phone ON public.whatsapp_outbound_mapping(to_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_review_id ON public.whatsapp_outbound_mapping(review_id);
