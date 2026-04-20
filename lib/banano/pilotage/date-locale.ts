import type { Locale } from 'date-fns';
import { de, enGB, enUS, es, fr, it, ja, pt, zhCN } from 'date-fns/locale';
import type { SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';

/** date-fns locale for pilotage / cash explorer date labels. */
export function siteLocaleToDateFnsLocale(code: string): Locale {
  const c = code.toLowerCase();
  if (!(SITE_LOCALE_CODES as readonly string[]).includes(c)) return enUS;
  const map: Record<SiteLocaleCode, Locale> = {
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
  return map[c as SiteLocaleCode];
}
