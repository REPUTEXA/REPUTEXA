-- Délai human-like : statut pending_publication pour réponses en attente de publication par le cron
-- (scheduled reste pour rétrocompatibilité ; le cron publie les deux)
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('pending', 'generating', 'scheduled', 'published', 'pending_publication'));
