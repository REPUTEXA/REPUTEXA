import { routing } from '@/i18n/routing';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Locale pour les réponses JSON API : cookie `NEXT_LOCALE`, puis `Accept-Language`, puis défaut. */
export function apiLocaleFromRequest(request: Request): string {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const name = trimmed.slice(0, eq).trim();
      if (name !== LOCALE_COOKIE) continue;
      const value = decodeURIComponent(trimmed.slice(eq + 1).trim());
      if (value) return normalizeAppLocale(value);
    }
  }
  const accept = request.headers.get('accept-language');
  if (accept) {
    const first = accept.split(',')[0]?.trim().toLowerCase();
    if (first) {
      const code = first.split('-')[0];
      if ((routing.locales as readonly string[]).includes(code)) return code;
    }
  }
  return routing.defaultLocale;
}
