-- Cartes dashboard : état par zone géographique (dérivé du Guardian)

ALTER TABLE public.legal_guardian_state
  ADD COLUMN IF NOT EXISTS compliance_zones JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.legal_guardian_state.compliance_zones IS
  'Map zoneId → statut UI (ok|watch|action_required|local_specific) ; alimentée à chaque run Guardian.';
