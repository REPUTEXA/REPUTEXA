-- Index pour pagination keyset (user_id + tri + tie-break id) — scans stables sans OFFSET.

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_members_user_updated_keyset
  ON public.banano_loyalty_members (user_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_events_user_created_keyset
  ON public.banano_loyalty_events (user_id, created_at DESC, id DESC);
