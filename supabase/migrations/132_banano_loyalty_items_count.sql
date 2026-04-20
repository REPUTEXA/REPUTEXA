-- Pilotage : nombre d’articles / lignes sur le ticket (optionnel, saisi à la caisse).

ALTER TABLE public.banano_loyalty_events
  ADD COLUMN IF NOT EXISTS items_count INT
  CHECK (
    items_count IS NULL OR (items_count >= 0 AND items_count <= 100000)
  );

COMMENT ON COLUMN public.banano_loyalty_events.items_count IS
  'Nombre d’articles (ou de lignes) sur le ticket — optionnel, pour volumes vendus / jour au pilotage.';
