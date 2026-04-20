-- Réserve idempotente du message d’accueil support (évite double greeting en cas de requêtes parallèles)

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS support_bootstrap_done BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tickets.support_bootstrap_done IS
  'True si le premier message IA « Log-watcher » a été enregistré pour ce ticket.';
