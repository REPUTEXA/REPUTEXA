-- Autoriser les admins à modifier les mises à jour manuelles (app_updates)
DROP POLICY IF EXISTS "app_updates_update_admin" ON public.app_updates;

CREATE POLICY "app_updates_update_admin"
  ON public.app_updates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
