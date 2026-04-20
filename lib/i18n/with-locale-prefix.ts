import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';

const PREFIX_RE = new RegExp(
  `^\\/(${SITE_LOCALE_CODES.join('|')})(?=\\/|$|\\?)`,
  'i'
);

/**
 * Construit un chemin sous /{locale}/… sans dupliquer le segment locale.
 * Le middleware enregistre souvent `next=/fr/dashboard` : ne pas produire `/fr/fr/dashboard`.
 */
export function withLocalePrefix(locale: string, nextPath: string, defaultPath = '/dashboard'): string {
  const p = nextPath.trim();
  const def = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  if (!p.startsWith('/')) {
    return `/${locale}${def}`;
  }
  if (PREFIX_RE.test(p)) {
    return p;
  }
  return `/${locale}${p}`;
}
