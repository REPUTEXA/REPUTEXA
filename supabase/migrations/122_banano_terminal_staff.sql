-- Module Équipage : équipiers terminal (PIN), traçabilité sur événements fidélité et créations fiches.

CREATE TABLE IF NOT EXISTS public.banano_terminal_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL
    CHECK (char_length(trim(display_name)) >= 1 AND char_length(display_name) <= 80),
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_terminal_staff_user_active
  ON public.banano_terminal_staff (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_banano_terminal_staff_user_id
  ON public.banano_terminal_staff (user_id);

CREATE OR REPLACE FUNCTION public.set_banano_terminal_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banano_terminal_staff_updated_at ON public.banano_terminal_staff;
CREATE TRIGGER banano_terminal_staff_updated_at
  BEFORE UPDATE ON public.banano_terminal_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_banano_terminal_staff_updated_at();

ALTER TABLE public.banano_terminal_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_terminal_staff_select_own" ON public.banano_terminal_staff;
CREATE POLICY "banano_terminal_staff_select_own"
  ON public.banano_terminal_staff FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_terminal_staff_insert_own" ON public.banano_terminal_staff;
CREATE POLICY "banano_terminal_staff_insert_own"
  ON public.banano_terminal_staff FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_terminal_staff_update_own" ON public.banano_terminal_staff;
CREATE POLICY "banano_terminal_staff_update_own"
  ON public.banano_terminal_staff FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_terminal_staff_delete_own" ON public.banano_terminal_staff;
CREATE POLICY "banano_terminal_staff_delete_own"
  ON public.banano_terminal_staff FOR DELETE
  USING (auth.uid() = user_id);

-- Événements : équipier + type création fiche
ALTER TABLE public.banano_loyalty_events
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.banano_terminal_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_events_user_staff_created
  ON public.banano_loyalty_events (user_id, staff_id, created_at DESC);

ALTER TABLE public.banano_loyalty_events
  DROP CONSTRAINT IF EXISTS banano_loyalty_events_event_type_check;

ALTER TABLE public.banano_loyalty_events
  ADD CONSTRAINT banano_loyalty_events_event_type_check CHECK (event_type IN (
    'earn_points', 'redeem_points', 'earn_stamps', 'redeem_stamps', 'encaisser_reward', 'member_created'
  ));

-- Fiches : qui a créé (première création téléphone)
ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES public.banano_terminal_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_created_staff
  ON public.banano_loyalty_members (user_id, created_by_staff_id)
  WHERE created_by_staff_id IS NOT NULL;

COMMENT ON TABLE public.banano_terminal_staff IS 'Équipiers caisse terminal : prénom + PIN hash ; désactivation coupe l’accès.';
COMMENT ON COLUMN public.banano_loyalty_events.staff_id IS 'Équipier ayant enregistré l’opération au terminal (si renseigné).';
COMMENT ON COLUMN public.banano_loyalty_members.created_by_staff_id IS 'Équipier ayant créé la fiche au terminal (si renseigné).';
