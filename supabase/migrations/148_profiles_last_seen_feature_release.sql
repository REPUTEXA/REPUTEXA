-- Dernière note produit « What's new » vue par l’utilisateur (modale dashboard).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_feature_release_id UUID REFERENCES public.app_updates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.last_seen_feature_release_id IS
  'Dernier communiqué app_updates (manuel) marqué comme vu — modale Nouveautés au prochain chargement si une version plus récente est publiée.';

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_feature_release
  ON public.profiles (last_seen_feature_release_id)
  WHERE last_seen_feature_release_id IS NOT NULL;
