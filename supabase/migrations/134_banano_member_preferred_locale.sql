-- Langue d’interface présumée pour les messages (dérivée du préfixe E.164 lors de la saisie).

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS preferred_locale text;

COMMENT ON COLUMN public.banano_loyalty_members.preferred_locale IS
  'Locale app présumée (fr|en|it|es|de|ja) déduite du pays du numéro E.164 ; mise à jour quand le téléphone change.';
