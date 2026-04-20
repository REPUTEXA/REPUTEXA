import { SITE_LOCALE_CODES, siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

function resolveIntlLocale(locale: string | undefined | null): string {
  const raw = (locale ?? '').trim();
  if (!raw) return 'en-US';
  const short = raw.toLowerCase().split('-')[0];
  if ((SITE_LOCALE_CODES as readonly string[]).includes(short)) {
    return siteLocaleToIntlDateTag(short);
  }
  return raw;
}

/** Formate un montant (neutre : BCP 47 résolu, repli ISO devise). */
export function formatCurrency(amount: number, locale: string, currency = 'EUR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const tag = resolveIntlLocale(locale);
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(2)} ${currency}`;
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

  const resolvedLocale = resolveIntlLocale(locale);

  try {
    return new Intl.DateTimeFormat(resolvedLocale, options).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

