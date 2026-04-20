-- Incidents / limitations connues côté plateforme — alimentent le support IA
-- (ex. « bug connu, correction prévue sous 2 h »).

CREATE TABLE IF NOT EXISTS public.system_health_intelligence (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 TEXT NOT NULL UNIQUE,
  title                TEXT NOT NULL,
  -- Texte court affichable au client via le conseiller IA
  customer_summary     TEXT NOT NULL,
  internal_notes       TEXT,
  status               TEXT NOT NULL DEFAULT 'investigating'
    CHECK (status IN ('investigating', 'scheduled_fix', 'monitoring', 'resolved')),
  eta_resolution_at    TIMESTAMPTZ,
  affects_modules      TEXT[],
  is_public            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shi_active
  ON public.system_health_intelligence (status, updated_at DESC)
  WHERE status IS DISTINCT FROM 'resolved';

COMMENT ON TABLE public.system_health_intelligence IS
  'Base des incidents / limitations plateforme connus du support (service_role).';

ALTER TABLE public.system_health_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_health_intelligence_no_client"
  ON public.system_health_intelligence
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Exemple (SQL manuel dashboard) :
-- INSERT INTO public.system_health_intelligence
--   (slug, title, customer_summary, status, eta_resolution_at, affects_modules)
-- VALUES
--   ('exemple_sync',
--    'Synchronisation avis',
--    'Notre équipe corrige une lenteur temporaire sur la synchronisation des avis Google. Merci de votre patience.',
--    'scheduled_fix',
--    now() + interval '2 hours',
--    ARRAY['reviews', 'google']);
