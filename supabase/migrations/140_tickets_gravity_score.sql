-- Nexus : score de gravité (priorisation admin 0–100), calculé au bootstrap

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS gravity_score SMALLINT
    CHECK (gravity_score IS NULL OR (gravity_score >= 0 AND gravity_score <= 100));

CREATE INDEX IF NOT EXISTS idx_tickets_open_gravity
  ON public.tickets(status, gravity_score DESC NULLS LAST)
  WHERE status = 'open';

COMMENT ON COLUMN public.tickets.gravity_score IS
  'Nexus — urgence relative (0 = calme, 100 = critique) ; mis à jour au bootstrap support.';
