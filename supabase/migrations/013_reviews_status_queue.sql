-- Queue intelligente : status, scheduled_at, ai_response, whatsapp_sent
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'scheduled', 'published')),
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_response TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quick_reply_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_scheduled_at ON public.reviews(scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_quick_reply_token ON public.reviews(quick_reply_token) WHERE quick_reply_token IS NOT NULL;
