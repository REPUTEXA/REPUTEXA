-- Stats équipe : traçage auth salarié sur événements fidélité + complétions de tâches.

-- Lien optionnel : équipier PIN terminal ↔ compte app salarié (auth.users)
ALTER TABLE public.banano_terminal_staff
  ADD COLUMN IF NOT EXISTS linked_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_banano_terminal_staff_user_linked_auth
  ON public.banano_terminal_staff (user_id, linked_auth_user_id)
  WHERE linked_auth_user_id IS NOT NULL;

COMMENT ON COLUMN public.banano_terminal_staff.linked_auth_user_id IS
  'Compte REPUTEXA salarié (merchant_staff) lié à ce PIN ; sert aux compteurs Wallet sur le dashboard équipe.';

-- Qui a traité l’opération côté « personne » (en plus de staff_id = ligne terminal)
ALTER TABLE public.banano_loyalty_events
  ADD COLUMN IF NOT EXISTS processed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_events_merchant_processor_day
  ON public.banano_loyalty_events (user_id, processed_by_user_id, created_at DESC);

COMMENT ON COLUMN public.banano_loyalty_events.processed_by_user_id IS
  'Utilisateur auth ayant enregistré l’opération (salarié app), aligné sur merchant_team_members.member_user_id.';

-- Tâches / missions (dispatch ou manuel)
CREATE TABLE IF NOT EXISTS public.merchant_staff_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_ref TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'dispatch', 'other')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_merchant_staff_tasks_merchant_staff_week
  ON public.merchant_staff_task_completions (merchant_user_id, staff_user_id, completed_at DESC);

COMMENT ON TABLE public.merchant_staff_task_completions IS
  'Une ligne par complétion de tâche (missions / dispatch vocal côté terrain).';

ALTER TABLE public.merchant_staff_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_staff_tasks_select ON public.merchant_staff_task_completions
  FOR SELECT USING (merchant_user_id = auth.uid());

CREATE POLICY merchant_staff_tasks_insert_staff ON public.merchant_staff_task_completions
  FOR INSERT WITH CHECK (
    staff_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.merchant_team_members m
      WHERE m.merchant_user_id = merchant_user_id
        AND m.member_user_id = auth.uid()
        AND m.status = 'active'
    )
  );
