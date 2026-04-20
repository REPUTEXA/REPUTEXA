-- Brouillons de génération de locale (transcréation IA) — pilotage depuis Babel Guardian / Expansion.

CREATE TABLE IF NOT EXISTS public.babel_expansion_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale_code TEXT NOT NULL,
  target_label TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  messages_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_level_keys_done TEXT[] NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_by_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS babel_expansion_drafts_locale_created_idx
  ON public.babel_expansion_drafts (locale_code, created_at DESC);

ALTER TABLE public.babel_expansion_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY babel_expansion_drafts_admin_all
  ON public.babel_expansion_drafts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.babel_expansion_drafts IS 'Brouillons messages/*.json générés par lots (IA) — à valider puis copier dans le repo.';
