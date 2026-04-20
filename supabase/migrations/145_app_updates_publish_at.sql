-- Date/heure de visibilité publique des communiqués manuels (programmation possible)

ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS publish_at timestamptz;

UPDATE public.app_updates
SET publish_at = created_at
WHERE publish_at IS NULL;

ALTER TABLE public.app_updates
  ALTER COLUMN publish_at SET DEFAULT now(),
  ALTER COLUMN publish_at SET NOT NULL;

COMMENT ON COLUMN public.app_updates.publish_at IS
  'Instant à partir duquel le communiqué est visible (SELECT RLS : non-admins seulement si publish_at <= now()).';

-- Remplacer la lecture « tout le monde voit tout » par : publiés OU admin
DROP POLICY IF EXISTS "app_updates_select_authenticated" ON public.app_updates;

CREATE POLICY "app_updates_select_published_or_admin"
  ON public.app_updates FOR SELECT
  TO authenticated
  USING (
    publish_at <= now()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
