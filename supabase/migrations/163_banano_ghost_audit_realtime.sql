-- Realtime : flux Sentinel Live (dashboard Banano) sur les événements Agent Ghost

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'banano_ghost_audit_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.banano_ghost_audit_events;
  END IF;
END $$;
