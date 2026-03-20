-- Ajout d'un titre personnalisable sur les tickets support
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS title TEXT;
