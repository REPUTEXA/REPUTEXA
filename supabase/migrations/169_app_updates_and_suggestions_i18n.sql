-- Textes de communiqués par locale (lecture selon la langue du dashboard).
ALTER TABLE public.app_updates
  ADD COLUMN IF NOT EXISTS title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_updates.title_i18n IS
  'Titres par locale (fr, en, …). Repli sur `title` si clé absente.';
COMMENT ON COLUMN public.app_updates.content_i18n IS
  'Corps par locale. Repli sur `content` si clé absente.';

ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS update_title_i18n jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS update_content_i18n jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_suggestions.update_title_i18n IS
  'Titre affiché dans « Mises à jour » par locale (suggestion livrée).';
COMMENT ON COLUMN public.app_suggestions.update_content_i18n IS
  'Annonce officielle par locale lorsque status = DONE.';

-- Rétrocompat : dupliquer le texte existant sur toutes les locales.
UPDATE public.app_updates u
SET
  title_i18n = jsonb_build_object(
    'fr', u.title,
    'en', u.title,
    'es', u.title,
    'de', u.title,
    'it', u.title,
    'pt', u.title,
    'ja', u.title,
    'zh', u.title
  ),
  content_i18n = jsonb_build_object(
    'fr', u.content,
    'en', u.content,
    'es', u.content,
    'de', u.content,
    'it', u.content,
    'pt', u.content,
    'ja', u.content,
    'zh', u.content
  )
WHERE title_i18n = '{}'::jsonb OR content_i18n = '{}'::jsonb;

UPDATE public.app_suggestions s
SET
  update_title_i18n = jsonb_build_object(
    'fr', s.title,
    'en', s.title,
    'es', s.title,
    'de', s.title,
    'it', s.title,
    'pt', s.title,
    'ja', s.title,
    'zh', s.title
  ),
  update_content_i18n = jsonb_build_object(
    'fr', COALESCE(s.update_content, ''),
    'en', COALESCE(s.update_content, ''),
    'es', COALESCE(s.update_content, ''),
    'de', COALESCE(s.update_content, ''),
    'it', COALESCE(s.update_content, ''),
    'pt', COALESCE(s.update_content, ''),
    'ja', COALESCE(s.update_content, ''),
    'zh', COALESCE(s.update_content, '')
  )
WHERE (s.update_content IS NOT NULL AND trim(s.update_content) <> '')
    AND (update_title_i18n = '{}'::jsonb OR update_content_i18n = '{}'::jsonb);
