import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/** Chaîne localisée depuis un map JSONB `{ "fr": "…", "en": "…" }` avec repli ordonné. */
export function pickLocalizedString(
  map: Record<string, string> | null | undefined,
  locale: string,
  legacyFallback: string
): string {
  const loc = normalizeAppLocale(locale) as SiteLocaleCode;
  const order: string[] = [loc, 'en', 'fr'];
  for (const k of order) {
    const v = map?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (const code of SITE_LOCALE_CODES) {
    const v = map?.[code];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return typeof legacyFallback === 'string' ? legacyFallback : '';
}
