import { grandCentralCookieSecure } from '@/lib/admin/grand-central-cookies';

const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Options pour `cookies.set('NEXT_LOCALE', …)` (middleware / Route Handlers).
 * `secure` aligné sur la prod / Vercel via {@link grandCentralCookieSecure}.
 */
export function nextLocaleCookieSetOptions(): {
  path: string;
  maxAge: number;
  sameSite: 'lax';
  secure?: boolean;
} {
  const base = {
    path: '/',
    maxAge: MAX_AGE,
    sameSite: 'lax' as const,
  };
  if (!grandCentralCookieSecure()) return base;
  return { ...base, secure: true };
}

/**
 * Valeur complète pour `document.cookie` (composants client).
 * En prod, n’ajoute `Secure` que si la page est servie en HTTPS (évite un cookie refusé en `next start` sur http://localhost).
 */
export function buildNextLocaleDocumentCookie(localeCode: string): string {
  const secure =
    grandCentralCookieSecure() &&
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:';
  const tail = secure ? ';Secure' : '';
  return `NEXT_LOCALE=${encodeURIComponent(localeCode)};path=/;max-age=${MAX_AGE};sameSite=lax${tail}`;
}
