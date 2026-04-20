-- Lien direct Google pour laisser un avis (placeid = google_location_id)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_review_url TEXT;
