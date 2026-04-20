-- Archétype visuel Reputexa (personnage + strip) et mode d'aperçu tampons / points

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_wallet_archetype_id TEXT,
  ADD COLUMN IF NOT EXISTS banano_wallet_preview_balance_mode TEXT;

COMMENT ON COLUMN public.profiles.banano_wallet_archetype_id IS
  'Archétype métier (butcher, bakery, …) pour assets strip / illustration.';
COMMENT ON COLUMN public.profiles.banano_wallet_preview_balance_mode IS
  'Aperçu designer : points ou tampons. NULL = suit banano_loyalty_mode.';
