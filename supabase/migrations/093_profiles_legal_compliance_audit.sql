-- Preuve RGPD : horodatage + version des documents au moment où le marchand valide la conformité.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_compliance_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_compliance_accepted_legal_version integer;

COMMENT ON COLUMN public.profiles.legal_compliance_accepted_at IS
  'Date/heure de validation de la case conformité (confirm-email et/ou Collecte d''avis).';

COMMENT ON COLUMN public.profiles.legal_compliance_accepted_legal_version IS
  'Valeur legal_versioning.version (globale) au moment de cette validation — preuve d''alignement texte / produit.';
