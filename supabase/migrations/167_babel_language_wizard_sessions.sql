-- Sessions assistant « langue native » (étapes, aperçus IA, sauvegarde / restauration).

CREATE TABLE IF NOT EXISTS public.babel_language_wizard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS babel_language_wizard_sessions_created_idx
  ON public.babel_language_wizard_sessions (created_at DESC);

ALTER TABLE public.babel_language_wizard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY babel_language_wizard_sessions_admin_all
  ON public.babel_language_wizard_sessions
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

COMMENT ON TABLE public.babel_language_wizard_sessions IS 'État persistant assistant Babel (étapes, snippets IA) — sauvegarde / reprise.';
