-- Retrait de TripAdvisor : sources autorisées = google, facebook, trustpilot uniquement.
-- Les anciennes lignes tripadvisor sont rattachées à google pour ne pas violer la contrainte.

UPDATE public.reviews SET source = 'google' WHERE lower(source) = 'tripadvisor';

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_source_check;

ALTER TABLE public.reviews ADD CONSTRAINT reviews_source_check
  CHECK (source IN ('google', 'facebook', 'trustpilot'));
