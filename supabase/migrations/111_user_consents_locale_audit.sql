-- Langue interface + navigateur au moment du consentement cookies (traçabilité admin / RGPD)

ALTER TABLE public.user_consents
  ADD COLUMN IF NOT EXISTS ui_locale TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS navigator_language TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accept_language TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.user_consents.ui_locale IS
  'Locale interface next-intl active au moment du choix (fr, en, it, …).';

COMMENT ON COLUMN public.user_consents.navigator_language IS
  'navigator.language du navigateur au moment du choix (ex. it-IT).';

COMMENT ON COLUMN public.user_consents.accept_language IS
  'En-tête Accept-Language reçu côté serveur (extrait, audit).';

CREATE INDEX IF NOT EXISTS idx_user_consents_ui_locale_updated
  ON public.user_consents (ui_locale, updated_at DESC);
