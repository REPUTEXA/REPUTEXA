-- Ajout de la colonne response_text pour marquer les avis comme répondus
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS response_text TEXT;
