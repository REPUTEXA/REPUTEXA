-- REPUTEXA: Table profiles (liée à auth.users) avec subscription_plan
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_name TEXT NOT NULL DEFAULT '',
  subscription_plan TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'manager', 'Dominator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table reviews: avis clients (Nom, Note, Commentaire, Source)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Google' CHECK (source IN ('Google', 'TripAdvisor', 'Facebook', 'Autre')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes par user_id
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

-- Trigger: créer un profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, establishment_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'establishment_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profil: lecture par propriétaire"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profil: mise à jour par propriétaire"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insertion uniquement pour son propre id (trigger handle_new_user utilise SECURITY DEFINER)
CREATE POLICY "Profil: insertion par propriétaire"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS: reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avis: lecture par propriétaire"
  ON public.reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Avis: insertion par propriétaire"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Avis: mise à jour par propriétaire"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Avis: suppression par propriétaire"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Mise à jour updated_at sur profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
