-- Pilier conformité site : consentements cookies/traceurs, journal audit, veille Guardian

-- 1) Colonne traductions HTML par locale (clé = en|fr|es|de|it, valeur = HTML)
ALTER TABLE public.legal_versioning
  ADD COLUMN IF NOT EXISTS content_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.legal_versioning.content_translations IS
  'Versions HTML publiées par locale (ex. {"en":"...","it":"..."}). Le champ content reste la version française maître.';

-- 2) Consentements visiteurs / utilisateurs (distinct des consent_logs WhatsApp)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  anonymous_id TEXT,
  consent_status TEXT NOT NULL CHECK (consent_status IN ('all', 'necessary', 'refused')),
  country TEXT NOT NULL DEFAULT 'ZZ',
  legal_version_id INTEGER NOT NULL DEFAULT 0,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_consents_subject_ck CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL)
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consents_one_per_user
  ON public.user_consents (user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consents_one_per_anon
  ON public.user_consents (anonymous_id) WHERE anonymous_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_consents_country_updated
  ON public.user_consents (country, updated_at DESC);

COMMENT ON TABLE public.user_consents IS
  'Choix cookies/traceurs site (all | necessary | refused), pays, version légale au moment du consentement — preuve RGPD ePrivacy.';

-- 3) Journal audit conformité (publication, Guardian, échantillons)
CREATE TABLE IF NOT EXISTS public.legal_compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'legal_publish', 'guardian_run', 'guardian_alert', 'guardian_draft_created', 'ai_audit'
  )),
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  legal_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_compliance_logs_created
  ON public.legal_compliance_logs (created_at DESC);

COMMENT ON TABLE public.legal_compliance_logs IS
  'Piste d''audit : publications légales, exécutions Guardian, alertes IA.';

-- 4) État singleton du Guardian (dernière vérif + inventaire cookies détecté)
CREATE TABLE IF NOT EXISTS public.legal_guardian_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_status IN ('idle', 'ok', 'review_needed', 'error')),
  last_summary TEXT,
  cookie_inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  regions_flagged TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  dual_validation JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.legal_guardian_state (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.legal_guardian_state IS
  'État agrégé du job de veille juridique (REPUTEXA Guardian).';

-- 5) Brouillons pré-remplis par le Guardian (validation admin)
CREATE TABLE IF NOT EXISTS public.legal_guardian_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('cgu', 'politique_confidentialite', 'mentions_legales')),
  content_html TEXT NOT NULL DEFAULT '',
  summary_of_changes TEXT NOT NULL DEFAULT '',
  client_email_draft TEXT,
  detected_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  search_digest TEXT,
  dual_validation JSONB,
  status TEXT NOT NULL DEFAULT 'pending_admin'
    CHECK (status IN ('pending_admin', 'dismissed', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_guardian_drafts_status_created
  ON public.legal_guardian_drafts (status, created_at DESC);

COMMENT ON TABLE public.legal_guardian_drafts IS
  'Proposition de mise à jour légale générée par le Guardian — statut pending_admin jusqu''à validation UI.';

-- 5b) Config clé / valeur (métadonnées conformité gérées par jobs ou admin service)
CREATE TABLE IF NOT EXISTS public.legal_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.legal_config IS
  'Paramètres et métadonnées de conformité (ex. dernière liste cookies agrégée, flags Guardian).';

ALTER TABLE public.legal_config ENABLE ROW LEVEL SECURITY;

-- 6) RLS
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_guardian_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_guardian_drafts ENABLE ROW LEVEL SECURITY;

-- Pas de policy public sur legal_* — lecture écriture via service_role uniquement

-- Utilisateur connecté : lecture / mise à jour de sa propre ligne
CREATE POLICY user_consents_select_own ON public.user_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_consents_upsert_own ON public.user_consents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_consents_update_own ON public.user_consents
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Pas d'INSERT anonyme côté client : API route (service role) pour anonymous_id

GRANT SELECT, INSERT, UPDATE ON public.user_consents TO authenticated;

-- Admin lit tout via service role (bypass RLS)
