-- Colonne completed_at : date de passage en DONE (pour changelog / badge NEW)
ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_suggestions_completed_at
  ON public.app_suggestions(completed_at DESC NULLS LAST)
  WHERE status = 'DONE';

-- Mettre à jour completed_at pour les lignes déjà en DONE (optionnel)
UPDATE public.app_suggestions
  SET completed_at = created_at
  WHERE status = 'DONE' AND completed_at IS NULL;

-- Policy UPDATE : tout utilisateur authentifié peut changer le statut (admin peut être restreint plus tard)
CREATE POLICY "app_suggestions_update_authenticated"
  ON public.app_suggestions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON COLUMN public.app_suggestions.completed_at IS 'Date de passage au statut DONE (changelog, badge NEW)';
