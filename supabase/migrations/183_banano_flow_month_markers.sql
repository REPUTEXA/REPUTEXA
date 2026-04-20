-- Marqueurs d'« archive » mensuelle pour le flux caisse (métadonnée seule : les lignes banano_loyalty_events ne sont pas supprimées).

CREATE TABLE IF NOT EXISTS public.banano_loyalty_flow_month_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  month_ym TEXT NOT NULL CHECK (month_ym ~ '^\d{4}-\d{2}$'),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_ym)
);

CREATE INDEX IF NOT EXISTS idx_banano_flow_month_markers_user_month
  ON public.banano_loyalty_flow_month_markers (user_id, month_ym DESC);

COMMENT ON TABLE public.banano_loyalty_flow_month_markers IS
  'Le marchand marque un mois comme « archivé » (sauvegarde / clôture) après export ; les données restent dans banano_loyalty_events.';

ALTER TABLE public.banano_loyalty_flow_month_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_flow_month_markers_select_own"
  ON public.banano_loyalty_flow_month_markers;
CREATE POLICY "banano_flow_month_markers_select_own"
  ON public.banano_loyalty_flow_month_markers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_flow_month_markers_insert_own"
  ON public.banano_loyalty_flow_month_markers;
CREATE POLICY "banano_flow_month_markers_insert_own"
  ON public.banano_loyalty_flow_month_markers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_flow_month_markers_delete_own"
  ON public.banano_loyalty_flow_month_markers;
CREATE POLICY "banano_flow_month_markers_delete_own"
  ON public.banano_loyalty_flow_month_markers FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_flow_auto_archive_monthly BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.banano_flow_auto_archive_monthly IS
  'Si true : rappel / workflow fin de mois pour exporter le flux (les données ne sont jamais effacées côté serveur).';
