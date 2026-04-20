-- Sentinel : incidents système + logs d'auto-guérison

CREATE TABLE IF NOT EXISTS public.system_incidents (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT      NOT NULL,                                   -- 'database' | 'openai' | 'anthropic' | 'whatsapp' | 'webhooks' | 'sentinel'
  status      TEXT      NOT NULL CHECK (status IN ('ok', 'degraded', 'critical', 'auto_fixed')),
  message     TEXT,
  latency_ms  INT,                                                   -- temps de réponse mesuré
  auto_fixed  BOOLEAN   NOT NULL DEFAULT false,
  alert_sent  BOOLEAN   NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_incidents_created  ON public.system_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_service  ON public.system_incidents(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status   ON public.system_incidents(status, created_at DESC);

-- Accès admin uniquement (service role pour le cron, supabase auth pour le panel)
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_incidents_admin_only"
  ON public.system_incidents FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.system_incidents IS
  'Logs Sentinel : résultats des health-checks toutes les 10 min, incidents auto-réparés et alertes envoyées.';
