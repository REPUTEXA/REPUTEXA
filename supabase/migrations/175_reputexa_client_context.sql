-- Mémoire client par marchand pour IA / WhatsApp (faits vérifiables, pas d''hallucination forcée).
-- Une ligne par couple (compte marchand, téléphone client normalisé E.164).

CREATE TABLE IF NOT EXISTS public.reputexa_client_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  last_visit_at TIMESTAMPTZ,
  last_whatsapp_thread_at TIMESTAMPTZ,
  last_order_summary TEXT,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reputexa_client_context_phone_nonempty CHECK (length(trim(phone_e164)) > 0),
  UNIQUE (user_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_reputexa_client_context_user_updated
  ON public.reputexa_client_context (user_id, updated_at DESC);

COMMENT ON TABLE public.reputexa_client_context IS
  'Contexte client pour personnalisation IA : alimenté par webhooks / caisse ; préférences et derniers faits connus.';

ALTER TABLE public.reputexa_client_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reputexa_client_context_select_own" ON public.reputexa_client_context;
CREATE POLICY "reputexa_client_context_select_own"
  ON public.reputexa_client_context FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_client_context_insert_own" ON public.reputexa_client_context;
CREATE POLICY "reputexa_client_context_insert_own"
  ON public.reputexa_client_context FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_client_context_update_own" ON public.reputexa_client_context;
CREATE POLICY "reputexa_client_context_update_own"
  ON public.reputexa_client_context FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_client_context_delete_own" ON public.reputexa_client_context;
CREATE POLICY "reputexa_client_context_delete_own"
  ON public.reputexa_client_context FOR DELETE
  USING (auth.uid() = user_id);
