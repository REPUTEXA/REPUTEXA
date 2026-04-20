-- Vérification humaine des brouillons Guardian (avant publication officielle)

ALTER TABLE public.legal_guardian_drafts
  ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_verified_by UUID;

COMMENT ON COLUMN public.legal_guardian_drafts.admin_verified_at IS
  'Horodatage : l’admin indique avoir relu les sources / le brouillon.';
COMMENT ON COLUMN public.legal_guardian_drafts.admin_verified_by IS
  'auth.users.id ayant confirmé la vérification (optionnel, pas de FK pour compatibilité migrations).';
