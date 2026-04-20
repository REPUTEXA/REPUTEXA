-- Sentinel Phase 2 : colonnes pour l'agent d'auto-réparation Claude 3.5

ALTER TABLE public.system_incidents
  ADD COLUMN IF NOT EXISTS heal_status      TEXT CHECK (heal_status IN ('in_progress', 'applied', 'skipped', 'failed')),
  ADD COLUMN IF NOT EXISTS claude_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS heal_action      TEXT,
  ADD COLUMN IF NOT EXISTS deploy_triggered BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_system_incidents_heal
  ON public.system_incidents(status, heal_status, created_at DESC)
  WHERE status = 'critical';

COMMENT ON COLUMN public.system_incidents.heal_status      IS 'État de la tentative de réparation automatique par Claude 3.5';
COMMENT ON COLUMN public.system_incidents.claude_diagnosis IS 'Diagnostic et résumé de l''action générés par Claude 3.5 Sonnet';
COMMENT ON COLUMN public.system_incidents.heal_action      IS 'Action appliquée : code_fix:<chemin>, deploy_hook, env_issue, external_outage…';
COMMENT ON COLUMN public.system_incidents.deploy_triggered IS 'Vrai si un redéploiement Vercel a été déclenché';
