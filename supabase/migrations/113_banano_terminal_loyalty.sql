-- Terminal Banano : code PIN (hash) + fidélité points / tampons (RLS par commerçant)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS banano_loyalty_mode TEXT NOT NULL DEFAULT 'points'
    CHECK (banano_loyalty_mode IN ('points', 'stamps'));

COMMENT ON COLUMN public.profiles.banano_pin_hash IS 'Scrypt hash (salt:hex) du code PIN terminal Banano ; NULL = non configuré.';

CREATE TABLE IF NOT EXISTS public.banano_loyalty_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  points_balance INT NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  stamps_balance INT NOT NULL DEFAULT 0 CHECK (stamps_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_user_phone
  ON public.banano_loyalty_members (user_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_user_id
  ON public.banano_loyalty_members (user_id);

CREATE TABLE IF NOT EXISTS public.banano_loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.banano_loyalty_members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'earn_points', 'redeem_points', 'earn_stamps', 'redeem_stamps', 'encaisser_reward'
  )),
  delta_points INT NOT NULL DEFAULT 0,
  delta_stamps INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_events_member_created
  ON public.banano_loyalty_events (member_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_banano_loyalty_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banano_loyalty_members_updated_at ON public.banano_loyalty_members;
CREATE TRIGGER banano_loyalty_members_updated_at
  BEFORE UPDATE ON public.banano_loyalty_members
  FOR EACH ROW EXECUTE FUNCTION public.set_banano_loyalty_members_updated_at();

ALTER TABLE public.banano_loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banano_loyalty_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banano_loyalty_members_select_own" ON public.banano_loyalty_members;
CREATE POLICY "banano_loyalty_members_select_own"
  ON public.banano_loyalty_members FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_members_insert_own" ON public.banano_loyalty_members;
CREATE POLICY "banano_loyalty_members_insert_own"
  ON public.banano_loyalty_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_members_update_own" ON public.banano_loyalty_members;
CREATE POLICY "banano_loyalty_members_update_own"
  ON public.banano_loyalty_members FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_members_delete_own" ON public.banano_loyalty_members;
CREATE POLICY "banano_loyalty_members_delete_own"
  ON public.banano_loyalty_members FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_events_select_own" ON public.banano_loyalty_events;
CREATE POLICY "banano_loyalty_events_select_own"
  ON public.banano_loyalty_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "banano_loyalty_events_insert_own" ON public.banano_loyalty_events;
CREATE POLICY "banano_loyalty_events_insert_own"
  ON public.banano_loyalty_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
