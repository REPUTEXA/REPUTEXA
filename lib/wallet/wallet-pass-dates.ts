import { format } from 'date-fns';
import { de, enGB, enUS, es, fr, it, ja, pt, zhCN } from 'date-fns/locale';
import type { Locale } from 'date-fns';

const BY_SITE: Record<string, Locale> = {
  fr,
  en: enUS,
  'en-gb': enGB,
  es,
  de,
  it,
  pt,
  ja,
  zh: zhCN,
};

/** Formate une date d’historique au dos du pass selon la locale site (clé next-intl). */
export function formatWalletPassBackDate(iso: string, siteLocale: string): string {
  const L = BY_SITE[siteLocale] ?? fr;
  try {
    return format(new Date(iso), 'd MMM yyyy HH:mm', { locale: L });
  } catch {
    return iso;
  }
}
