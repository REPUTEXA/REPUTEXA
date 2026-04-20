-- Consentement légal avant paiement Stripe (étape confirm-email).
-- accepted_terms          : acceptation des CGU + politique de confidentialité (tous les plans).
-- accepted_zenith_terms   : acceptation spécifique Zenith (engagement RGPD renforcé).
-- accepted_at             : horodatage du consentement (non-répudiation).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_terms         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_zenith_terms  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at      timestamptz;

COMMENT ON COLUMN public.profiles.accepted_terms        IS 'Utilisateur a coché CGU + confidentialité avant paiement.';
COMMENT ON COLUMN public.profiles.accepted_zenith_terms IS 'Utilisateur a coché les conditions spécifiques Zenith (RGPD renforcé).';
COMMENT ON COLUMN public.profiles.terms_accepted_at     IS 'Horodatage du consentement, pour preuve non-répudiation.';
