-- Realtime : carte des passages fidélité (dashboard flux caisse)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'banano_loyalty_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.banano_loyalty_events;
  END IF;
END $$;
