import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const LOCALES = [...routing.locales];

/**
 * Locale pour écrans / e-mails Grand Central : préfixe d’URL `/{locale}` si présent,
 * sinon premier tag Accept-Language, sinon locale par défaut.
 */
export function localeForGrandCentralRequest(request: NextRequest): string {
  const pathname = request.nextUrl.pathname;
  for (const l of LOCALES) {
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l;
  }
  const al = request.headers.get('accept-language');
  if (al) {
    const first = al.split(',')[0]?.trim().split('-')[0]?.toLowerCase() ?? '';
    if (first) return normalizeAppLocale(first);
  }
  return routing.defaultLocale;
}
