-- Mises à jour créées manuellement par l'administrateur REPUTEXA
CREATE TABLE IF NOT EXISTS public.app_updates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié
CREATE POLICY "app_updates_select_authenticated"
  ON public.app_updates FOR SELECT
  TO authenticated
  USING (true);

-- Insertion : admin uniquement
CREATE POLICY "app_updates_insert_admin"
  ON public.app_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Suppression : admin uniquement
CREATE POLICY "app_updates_delete_admin"
  ON public.app_updates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE public.app_updates IS
  'Mises à jour produit créées manuellement par l''administrateur REPUTEXA';
