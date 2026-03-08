-- Source des avis : google, tripadvisor, trustpilot
-- Migration des anciennes valeurs vers le nouveau format
UPDATE public.reviews SET source = lower(source) WHERE source IN ('Google', 'TripAdvisor', 'Facebook', 'Autre');
UPDATE public.reviews SET source = 'google' WHERE source NOT IN ('google', 'tripadvisor', 'trustpilot');

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_source_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_source_check CHECK (source IN ('google', 'tripadvisor', 'trustpilot'));
ALTER TABLE public.reviews ALTER COLUMN source SET DEFAULT 'google';
