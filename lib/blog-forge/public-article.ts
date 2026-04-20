import type { Article } from '@/lib/i18n/blog-articles/types';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import type { BlogForgePostRow } from './types';

export function forgeArticleForLocale(row: BlogForgePostRow, locale: string): Article {
  const loc = normalizeAppLocale(locale);
  if (loc === 'fr') return row.source_fr;
  return (row.i18n[loc] as Article | undefined) ?? row.source_fr;
}
