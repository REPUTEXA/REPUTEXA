-- Étend l'énum "source" des avis pour inclure Facebook.
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_source_check;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_source_check CHECK (source IN ('google', 'tripadvisor', 'trustpilot', 'facebook'));

