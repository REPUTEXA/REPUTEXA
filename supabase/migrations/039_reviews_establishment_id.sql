-- Permet de filtrer les avis par établissement (multi-lieux)
-- NULL = établissement principal (profil), UUID = établissements(id)
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_establishment_id ON public.reviews(establishment_id);
