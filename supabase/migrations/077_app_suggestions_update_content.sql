-- Annonce de mise à jour générée par IA lors du passage au statut DONE
ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS update_content TEXT;

COMMENT ON COLUMN public.app_suggestions.update_content IS
  'Annonce de changelog rédigée par IA (Claude) lors du passage au statut DONE';
