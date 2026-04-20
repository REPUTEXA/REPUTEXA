/**
 * Affichage prix marché : EUR zone euro (montant + espace insécable + €) ;
 * locale `en` (GB) : livre sterling avec symbole en tête (£179).
 */

const EURO_INTL: Record<string, string> = {
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

/**
 * @param amount nombre entier ou décimal (sans centimes forcés en UI marketing)
 */
export function formatDisplayMoney(amount: number, locale: string): string {
  if (locale === 'en') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const intlLocale = EURO_INTL[locale] ?? 'fr-FR';
  let formatted = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

  // Espace insécable avant le symbole € (homogénéise fr/es/de/it)
  formatted = formatted.replace(/([0-9.,]+)(\s|\u00A0|\u202F)*€/g, '$1\u00A0€');

  return formatted;
}
