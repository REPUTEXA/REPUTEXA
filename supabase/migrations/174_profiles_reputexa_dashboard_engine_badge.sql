-- Indicateur REPUTEXA dans le shell dashboard (préférence marchand).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputexa_dashboard_engine_badge BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.reputexa_dashboard_engine_badge IS
  'Si true, affiche le badge REPUTEXA (moteur actif) dans le header du dashboard lorsque le plan inclut les surfaces IA (Pulse/Zénith).';
