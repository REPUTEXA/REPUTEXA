-- Portail légal : le marchand doit valider la décharge RGPD avant usage du webhook / ressources légales connectées.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_compliance_accepted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.legal_compliance_accepted IS
  'True lorsque le marchand a validé la case de conformité (Collecte d''avis) — requis pour webhooks et ressources légales.';
