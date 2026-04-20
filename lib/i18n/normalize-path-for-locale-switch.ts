import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';

const LOCALE_SET = new Set<string>(SITE_LOCALE_CODES as readonly string[]);

/**
 * Enlève les segments initiaux qui ressemblent à une locale (y compris `jp` confondu avec `ja`)
 * pour éviter des URL du type `/es/jp/signup` lors du changement de langue.
 */
export function normalizePathnameForLocaleSwitch(pathname: string | null): string {
  if (!pathname || pathname === '/') return '';
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = path.split('/').filter(Boolean);
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i].toLowerCase();
    if (LOCALE_SET.has(seg) || seg === 'jp') {
      i += 1;
      continue;
    }
    break;
  }
  const rest = segments.slice(i);
  if (rest.length === 0) return '';
  return `/${rest.join('/')}`;
}
