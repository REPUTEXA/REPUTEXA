-- Préférences granulaires cookies (analytics / marketing) — bannière type Apple

ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS analytics_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_consents.analytics_opt_in IS
  'Mesure d’audience / statistiques (hors cookies strictement nécessaires).';

COMMENT ON COLUMN public.user_consents.marketing_opt_in IS
  'Personnalisation ou finalités marketing selon politique de confidentialité.';

ALTER TABLE public.user_consents DROP CONSTRAINT IF EXISTS user_consents_consent_status_check;

ALTER TABLE public.user_consents ADD CONSTRAINT user_consents_consent_status_check
  CHECK (consent_status IN ('all', 'necessary', 'refused', 'partial'));

UPDATE public.user_consents
SET analytics_opt_in = true, marketing_opt_in = true
WHERE consent_status = 'all' AND analytics_opt_in = false AND marketing_opt_in = false;

UPDATE public.user_consents
SET analytics_opt_in = false, marketing_opt_in = false
WHERE consent_status IN ('necessary', 'refused');
