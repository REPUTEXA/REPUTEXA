import type { AbstractIntlMessages } from 'next-intl';
import { mergeMessagesDeep } from '@/lib/i18n/merge-messages-deep';
import { injectBrandIntoMessages } from '@/lib/i18n/inject-brand-into-messages';
import { injectPricingIntoMessages } from '@/lib/i18n/inject-pricing-into-messages';
import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { getBrandName } from '@/src/lib/empire-settings';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';
import enGb from '@/messages/en-gb.json';
import es from '@/messages/es.json';
import de from '@/messages/de.json';
import it from '@/messages/it.json';
import pt from '@/messages/pt.json';
import ja from '@/messages/ja.json';
import zh from '@/messages/zh.json';
/* @babel-anchor server-pack-import-insert */

const base = fr as unknown as Record<string, unknown>;

const rawByLocale: Record<SiteLocaleCode, Record<string, unknown>> = {
  fr: fr as unknown as Record<string, unknown>,
  en: en as unknown as Record<string, unknown>,
  'en-gb': enGb as unknown as Record<string, unknown>,
  es: es as unknown as Record<string, unknown>,
  de: de as unknown as Record<string, unknown>,
  it: it as unknown as Record<string, unknown>,
  pt: pt as unknown as Record<string, unknown>,
  ja: ja as unknown as Record<string, unknown>,
  zh: zh as unknown as Record<string, unknown>,
  /* @babel-anchor server-pack-raw-insert */
};

/**
 * Messages next-intl complets pour une locale (même logique que la page : fr + surcharge locale).
 */
export function getServerMessagesForLocale(locale: string): AbstractIntlMessages {
  const code = (SITE_LOCALE_CODES as readonly string[]).includes(locale) ? (locale as SiteLocaleCode) : 'fr';
  const merged =
    code === 'fr'
      ? (fr as unknown as Record<string, unknown>)
      : code === 'en-gb'
        ? mergeMessagesDeep(mergeMessagesDeep(base, en as unknown as Record<string, unknown>), enGb as unknown as Record<string, unknown>)
        : mergeMessagesDeep(base, rawByLocale[code]);
  let messages = injectBrandIntoMessages(merged, getBrandName()) as Record<string, unknown>;
  messages = injectPricingIntoMessages(messages, code) as Record<string, unknown>;
  return messages as unknown as AbstractIntlMessages;
}
