/**
 * Formatage localisé pour dates et devises
 * Support multi-devise et formats de date par locale
 */

export type SupportedLocale = 'fr' | 'en' | 'es' | 'de' | 'ja';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  ja: 'ja-JP',
};

export function formatDate(
  date: Date | string | number,
  locale: SupportedLocale = 'fr',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' && 'getTime' in date ? date : new Date(date);
  const intlLocale = LOCALE_MAP[locale] ?? 'fr-FR';
  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(d);
}

export function formatDateTime(
  date: Date | string | number,
  locale: SupportedLocale = 'fr',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'object' && 'getTime' in date ? date : new Date(date);
  const intlLocale = LOCALE_MAP[locale] ?? 'fr-FR';
  return new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(d);
}

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'AED' | 'MXN' | 'BRL';

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'EUR',
  locale: SupportedLocale = 'fr'
): string {
  const intlLocale = LOCALE_MAP[locale] ?? 'fr-FR';
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(value: number, locale: SupportedLocale = 'fr'): string {
  const intlLocale = LOCALE_MAP[locale] ?? 'fr-FR';
  return new Intl.NumberFormat(intlLocale).format(value);
}
