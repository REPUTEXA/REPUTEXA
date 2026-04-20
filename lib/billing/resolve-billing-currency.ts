import { localeToBillingCurrency, type BillingCurrency } from '@/config/pricing';

export const USER_CURRENCY_COOKIE = 'user-currency';

const VALID = new Set<BillingCurrency>(['eur', 'usd', 'gbp', 'jpy', 'cny', 'chf', 'cad', 'aud']);

export function isBillingCurrency(value: string | null | undefined): value is BillingCurrency {
  return value != null && VALID.has(value as BillingCurrency);
}

/**
 * Lit la valeur du cookie `user-currency` depuis l’en-tête Cookie brut.
 */
export function parseUserCurrencyFromCookieHeader(cookieHeader: string | null | undefined): BillingCurrency | null {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.toLowerCase().startsWith(`${USER_CURRENCY_COOKIE}=`)) continue;
    const raw = trimmed.slice(USER_CURRENCY_COOKIE.length + 1).trim();
    const v = raw.toLowerCase();
    if (isBillingCurrency(v)) return v;
  }
  return null;
}

/**
 * Devise catalogue pour l’UI et Stripe : le cookie utilisateur prime sur la devise dérivée de la locale.
 */
export function resolveBillingCurrency(
  appLocale: string | null | undefined,
  cookieCurrency: BillingCurrency | null,
): BillingCurrency {
  return cookieCurrency ?? localeToBillingCurrency(appLocale);
}

/**
 * Après un premier paiement : la devise enregistrée sur le profil prime sur cookie et locale.
 */
export function resolveBillingCurrencyForCheckout(
  appLocale: string | null | undefined,
  cookieCurrency: BillingCurrency | null,
  profileBillingCurrency: string | null | undefined,
): BillingCurrency {
  if (isBillingCurrency(profileBillingCurrency)) return profileBillingCurrency;
  return resolveBillingCurrency(appLocale, cookieCurrency);
}
