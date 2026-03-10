-- Zenith Intelligence: tables pour le flux de capture d'avis WhatsApp (anti-spam, RGPD, lab amélioration)

-- 1. contact_history: historique des contacts (filtre 90 jours)
CREATE TABLE IF NOT EXISTS public.contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_history_user_phone ON public.contact_history(user_id, phone);
CREATE INDEX IF NOT EXISTS idx_contact_history_contacted_at ON public.contact_history(contacted_at);

-- 2. blacklist: numéros qui ont répondu Non/Stop (ne plus jamais contacter)
CREATE TABLE IF NOT EXISTS public.blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_user_phone ON public.blacklist(user_id, phone);

-- 3. private_feedback: suggestions d'amélioration (visible uniquement dashboard patron)
CREATE TABLE IF NOT EXISTS public.private_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  classification TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_feedback_user_id ON public.private_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_private_feedback_created_at ON public.private_feedback(created_at DESC);

-- 4. whatsapp_capture_session: état de la conversation Capture (Oui → IA → proposition → feedback privé)
CREATE TABLE IF NOT EXISTS public.whatsapp_capture_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'opt_in_sent',
  opted_in BOOLEAN DEFAULT false,
  raw_feedback TEXT,
  draft_review_text TEXT,
  review_published BOOLEAN DEFAULT false,
  private_feedback_id UUID REFERENCES public.private_feedback(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capture_session_phone ON public.whatsapp_capture_session(phone);
CREATE INDEX IF NOT EXISTS idx_capture_session_user_id ON public.whatsapp_capture_session(user_id);

-- RLS pour tables admin (lecture par owner)
ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_capture_session ENABLE ROW LEVEL SECURITY;

-- contact_history: lecture par propriétaire (admin bypass RLS pour insert)
CREATE POLICY "contact_history_select_owner" ON public.contact_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contact_history_insert_service" ON public.contact_history FOR INSERT WITH CHECK (true);

-- blacklist: idem
CREATE POLICY "blacklist_select_owner" ON public.blacklist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "blacklist_insert_service" ON public.blacklist FOR INSERT WITH CHECK (true);

-- private_feedback: lecture par propriétaire
CREATE POLICY "private_feedback_select_owner" ON public.private_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "private_feedback_insert_service" ON public.private_feedback FOR INSERT WITH CHECK (true);

-- capture_session: lecture par propriétaire
CREATE POLICY "capture_session_select_owner" ON public.whatsapp_capture_session FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "capture_session_insert_service" ON public.whatsapp_capture_session FOR INSERT WITH CHECK (true);
CREATE POLICY "capture_session_update_service" ON public.whatsapp_capture_session FOR UPDATE USING (true);
