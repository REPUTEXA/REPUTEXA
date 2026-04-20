import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

/** Montant en euros (nombre) → devise EUR formatée selon la locale marchand. */
export function formatLoyaltyEuroAmount(euros: number, locale?: string | null): string {
  const loc = normalizeAppLocale(locale ?? undefined);
  const tag = siteLocaleToIntlDateTag(loc);
  return new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR' }).format(euros);
}
