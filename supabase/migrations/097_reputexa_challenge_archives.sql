-- Archives des défis REPUTEXA terminés (snapshot barème + classements).

CREATE TABLE IF NOT EXISTS public.reputexa_challenge_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL DEFAULT 'Défi REPUTEXA',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  competition_message TEXT NOT NULL DEFAULT '',
  reward_description TEXT NOT NULL DEFAULT '',
  bonus_keywords TEXT[] NOT NULL DEFAULT '{}',
  tracked_employee_names TEXT[] NOT NULL DEFAULT '{}',
  team_points INT NOT NULL DEFAULT 0,
  score_leaderboard JSONB NOT NULL DEFAULT '[]',
  score_details JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_reputexa_archives_user_archived
  ON public.reputexa_challenge_archives (user_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_reputexa_archives_establishment
  ON public.reputexa_challenge_archives (user_id, establishment_id, archived_at DESC);

ALTER TABLE public.reputexa_challenge_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reputexa_archive_select_own" ON public.reputexa_challenge_archives;
CREATE POLICY "reputexa_archive_select_own"
  ON public.reputexa_challenge_archives FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_archive_insert_own" ON public.reputexa_challenge_archives;
CREATE POLICY "reputexa_archive_insert_own"
  ON public.reputexa_challenge_archives FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reputexa_archive_delete_own" ON public.reputexa_challenge_archives;
CREATE POLICY "reputexa_archive_delete_own"
  ON public.reputexa_challenge_archives FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.reputexa_challenge_archives IS 'Snapshot d’un défi archivé : paramètres, points équipe, classement, détail par avis.';
