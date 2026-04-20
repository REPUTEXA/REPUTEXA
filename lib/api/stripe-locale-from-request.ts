import { routing } from '@/i18n/routing';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const VALID = new Set<string>(routing.locales as unknown as string[]);

/**
 * Extrait le premier segment de chemin si c’est une locale du site (`/fr/...`, `/en-gb/...`).
 */
function localeFromPathname(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  const lower = seg.toLowerCase();
  return VALID.has(lower) ? lower : null;
}

/**
 * Locale pour Checkout / Portail Stripe : alignée sur l’URL du site.
 * 1) `Referer` (page courante du navigateur)
 * 2) paramètre de requête `locale` (si fourni par l’appelant)
 * 3) cookie `NEXT_LOCALE` / `Accept-Language` ({@link apiLocaleFromRequest})
 */
export function resolveStripePaymentLocaleFromRequest(
  request: Request,
  options?: { queryLocale?: string | null }
): string {
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const path = new URL(referer).pathname;
      const fromRef = localeFromPathname(path);
      if (fromRef) return fromRef;
    } catch {
      /* ignore invalid referer */
    }
  }
  const q = options?.queryLocale;
  if (q != null && String(q).trim() !== '') {
    return normalizeAppLocale(q);
  }
  return apiLocaleFromRequest(request);
}
