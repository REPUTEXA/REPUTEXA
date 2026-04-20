-- Langue du tableau de bord au moment de la création (pour l’UI : libellé « rédigée en … »).
ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS author_locale text;

COMMENT ON COLUMN public.app_suggestions.author_locale IS
  'Locale dashboard (fr, en, …) lors de la création de la suggestion.';
