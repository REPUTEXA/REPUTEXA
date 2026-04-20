-- IA Forge & Training : modes d'entraînement, snapshots métriques, RLHF, snippets, cross-learning.

CREATE TABLE IF NOT EXISTS public.ia_forge_agent_state (
  agent_key      TEXT PRIMARY KEY CHECK (agent_key ~ '^[a-z0-9_]+$'),
  training_mode  TEXT NOT NULL DEFAULT 'continuous'
    CHECK (training_mode IN ('continuous', 'burst', 'deep_dive')),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ia_forge_metric_daily (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day                  DATE NOT NULL,
  agent_key            TEXT NOT NULL,
  accuracy_pct         NUMERIC(6, 2),
  conversion_pct       NUMERIC(6, 2),
  repair_avg_minutes   NUMERIC(12, 2),
  relevance_pct        NUMERIC(6, 2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (day, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_ia_forge_metric_daily_day ON public.ia_forge_metric_daily (day DESC);
CREATE INDEX IF NOT EXISTS idx_ia_forge_metric_agent ON public.ia_forge_metric_daily (agent_key, day DESC);

CREATE TABLE IF NOT EXISTS public.ia_forge_rlhf_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key         TEXT NOT NULL DEFAULT 'reputexa_core',
  title             TEXT NOT NULL,
  context_text      TEXT NOT NULL,
  ai_draft          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'validated', 'corrected')),
  admin_correction  TEXT,
  meta              JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ia_forge_rlhf_pending ON public.ia_forge_rlhf_queue (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ia_forge_snippet (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key   TEXT NOT NULL,
  body        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'analysis' CHECK (source IN ('analysis', 'rlhf', 'cron', 'manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_forge_snippet_created ON public.ia_forge_snippet (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ia_forge_cross_learn (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent   TEXT NOT NULL,
  target_agent   TEXT NOT NULL DEFAULT 'negoguard',
  pattern        TEXT NOT NULL,
  notes          TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ia_forge_cross_created ON public.ia_forge_cross_learn (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ia_forge_context_store (
  key         TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS : accès applicatif via service_role uniquement (politiques « deny all »).
ALTER TABLE public.ia_forge_agent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_forge_metric_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_forge_rlhf_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_forge_snippet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_forge_cross_learn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_forge_context_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_forge_agent_state_no_client"
  ON public.ia_forge_agent_state FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "ia_forge_metric_daily_no_client"
  ON public.ia_forge_metric_daily FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "ia_forge_rlhf_queue_no_client"
  ON public.ia_forge_rlhf_queue FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "ia_forge_snippet_no_client"
  ON public.ia_forge_snippet FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "ia_forge_cross_learn_no_client"
  ON public.ia_forge_cross_learn FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "ia_forge_context_store_no_client"
  ON public.ia_forge_context_store FOR ALL USING (false) WITH CHECK (false);

COMMENT ON TABLE public.ia_forge_agent_state IS
  'Modes d''entraînement par agent (continuous / burst / deep_dive) — Forge admin.';
COMMENT ON TABLE public.ia_forge_metric_daily IS
  'Snapshots quotidiens des scores Intelligence (précision, conversion, réparation, pertinence).';
COMMENT ON TABLE public.ia_forge_rlhf_queue IS
  'File RLHF : décisions critiques à validater ou corriger par un admin.';
COMMENT ON TABLE public.ia_forge_snippet IS
  'Extraits de prompt / consignes générés par analyse GPT (fine-tuning symbolique).';
COMMENT ON TABLE public.ia_forge_cross_learn IS
  'Transfert d''objections / patterns (ex. REPUTEXA → NEGO-GUARD).';

INSERT INTO public.ia_forge_agent_state (agent_key, training_mode) VALUES
  ('reputexa_core', 'continuous'),
  ('babel', 'continuous'),
  ('nexus', 'continuous'),
  ('sentinel', 'burst'),
  ('guardian', 'burst')
ON CONFLICT (agent_key) DO NOTHING;
