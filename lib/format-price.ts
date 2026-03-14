/**
 * Localisation des prix : EN -> USD, sinon EUR.
 * Utilise Intl.NumberFormat pour l'affichage (1.000,00 € vs $1,000.00).
 */

const USD_AMOUNTS: Record<string, string> = {
  '59': '65',
  '97': '107',
  '157': '175',
  '179': '199',
};

const MONTH_SUFFIX: Record<string, string> = {
  fr: '/mois',
  en: '/month',
  es: '/mes',
  de: '/Monat',
  it: '/mese',
};

export function formatPrice(locale: string, amountEur: string): string {
  const useUsd = locale === 'en';
  const amount = useUsd ? (USD_AMOUNTS[amountEur] ?? amountEur) : amountEur;
  const num = parseInt(amount, 10);
  const suffix = MONTH_SUFFIX[locale] ?? '/month';

  const localeMap: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
  };
  const fmtLocale = localeMap[locale] ?? 'fr-FR';

  if (useUsd) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num) + suffix;
  }

  return new Intl.NumberFormat(fmtLocale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num) + suffix;
}
