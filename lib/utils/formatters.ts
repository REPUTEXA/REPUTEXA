export function formatCurrency(amount: number, locale: string, currency = 'EUR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale || 'fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    // Fallback très simple en cas d'erreur de locale
    return `${safeAmount.toFixed(0)} ${currency === 'EUR' ? '€' : currency}`;
  }
}

export function formatDate(
  date: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
): string {
  const d =
    date instanceof Date
      ? date
      : typeof date === 'string'
        ? new Date(date)
        : new Date(date);

  if (Number.isNaN(d.getTime())) return '';

  const resolvedLocale = locale === 'en' ? 'en-US' : locale || 'fr-FR';

  try {
    return new Intl.DateTimeFormat(resolvedLocale, options).format(d);
  } catch {
    return d.toLocaleDateString('fr-FR', options);
  }
}

