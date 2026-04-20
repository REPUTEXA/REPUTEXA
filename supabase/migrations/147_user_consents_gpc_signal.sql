ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS gpc_signal_observed BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_consents.gpc_signal_observed IS
  'Enregistrement : signal Global Privacy Control (GPC) observé (en-tête Sec-GPC ou équivalent).';
