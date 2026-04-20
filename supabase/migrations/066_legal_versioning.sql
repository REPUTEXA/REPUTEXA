-- Migration 066 : Système de versioning des documents légaux
-- Tables : legal_versioning
-- Champ profiles : last_legal_agreement_version

CREATE TABLE IF NOT EXISTS public.legal_versioning (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type   TEXT        NOT NULL CHECK (document_type IN ('cgu', 'politique_confidentialite', 'mentions_legales')),
  version         INTEGER     NOT NULL,
  content         TEXT        NOT NULL DEFAULT '',
  summary_of_changes TEXT     NOT NULL DEFAULT '',
  effective_date  DATE        NOT NULL,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.legal_versioning IS
  'Historique versionné des documents légaux (CGU, Politique de confidentialité, Mentions légales).';

COMMENT ON COLUMN public.legal_versioning.version IS
  'Numéro de version global incrémental. Chaque publication (tous types confondus) incrémente ce compteur.';

COMMENT ON COLUMN public.legal_versioning.summary_of_changes IS
  'Résumé des changements en français, affiché dans l''email de notification et la modale de consentement.';

-- Activer RLS
ALTER TABLE public.legal_versioning ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les versions publiées (nécessaire pour la modale côté client)
CREATE POLICY "legal_versioning_public_read"
  ON public.legal_versioning
  FOR SELECT
  USING (true);

-- Seul le service role (API admin) peut insérer / modifier / supprimer
CREATE POLICY "legal_versioning_service_role_write"
  ON public.legal_versioning
  FOR ALL
  USING (auth.role() = 'service_role');

-- Ajouter le champ de consentement dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_legal_agreement_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.last_legal_agreement_version IS
  'Dernière version des CGU/Politique acceptée par l''utilisateur. Si inférieure à la version actuelle de legal_versioning, une modale est affichée.';

-- Index pour récupérer rapidement la version courante (la plus récente)
CREATE INDEX IF NOT EXISTS idx_legal_versioning_version
  ON public.legal_versioning (version DESC);
