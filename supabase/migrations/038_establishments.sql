-- Table établissements : plusieurs lieux par utilisateur (user_id = profiles.id)
CREATE TABLE IF NOT EXISTS public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  address TEXT,
  google_location_id TEXT,
  google_location_name TEXT,
  google_location_address TEXT,
  google_connected_at TIMESTAMPTZ,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_establishments_user_id ON public.establishments(user_id);

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Établissements : lecture par propriétaire" ON public.establishments;
CREATE POLICY "Établissements : lecture par propriétaire"
  ON public.establishments FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Établissements : insertion par propriétaire" ON public.establishments;
CREATE POLICY "Établissements : insertion par propriétaire"
  ON public.establishments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Établissements : mise à jour par propriétaire" ON public.establishments;
CREATE POLICY "Établissements : mise à jour par propriétaire"
  ON public.establishments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Établissements : suppression par propriétaire" ON public.establishments;
CREATE POLICY "Établissements : suppression par propriétaire"
  ON public.establishments FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_establishments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS establishments_updated_at ON public.establishments;
CREATE TRIGGER establishments_updated_at
  BEFORE UPDATE ON public.establishments
  FOR EACH ROW EXECUTE FUNCTION public.set_establishments_updated_at();
