import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Locale du dashboard depuis le cookie défini par le middleware (`NEXT_LOCALE`). */
export function dashboardLocaleFromRequest(request: Request): string {
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
  return normalizeAppLocale(undefined);
}
