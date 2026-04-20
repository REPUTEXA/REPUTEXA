import { createTranslator } from 'next-intl';
import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

/** Alias : toutes les locales site supportées pour les e-mails auth (fallback fr comme le navigateur). */
export type EmailLocale = SiteLocaleCode;

const ALLOWED = new Set<string>(SITE_LOCALE_CODES);

export function normalizeEmailLocale(locale?: string | null): SiteLocaleCode {
  const n = (locale ?? 'fr').toLowerCase().trim();
  if (ALLOWED.has(n)) return n as SiteLocaleCode;
  const short = n.split('-')[0];
  return (ALLOWED.has(short) ? short : 'fr') as SiteLocaleCode;
}

export function getAuthEmailsTranslator(locale?: string | null) {
  const loc = normalizeEmailLocale(locale);
  const messages = getServerMessagesForLocale(loc);
  return createTranslator({ locale: loc, messages, namespace: 'AuthEmails' });
}

export type ZenithEmailShellCopy = {
  htmlLang: string;
  otpVerificationTitle: string;
  otpClickHint: string;
  otpValidityHint: string;
  otpCodeLinkTitle: string;
  teamSignoff: string;
  supportHelp: string;
  notConvincedPrefix: string;
};

export type ZenithEmailOptions = {
  shell: ZenithEmailShellCopy;
  pathLocale: string;
};

export function buildZenithShellCopy(locale?: string | null): ZenithEmailShellCopy {
  const t = getAuthEmailsTranslator(locale);
  return {
    htmlLang: t('zenith.htmlLang'),
    otpVerificationTitle: t('zenith.otpVerificationTitle'),
    otpClickHint: t('zenith.otpClickHint'),
    otpValidityHint: t('zenith.otpValidityHint'),
    otpCodeLinkTitle: t('zenith.otpCodeLinkTitle'),
    teamSignoff: t('zenith.teamSignoff'),
    supportHelp: t('zenith.supportHelp'),
    notConvincedPrefix: t('zenith.notConvincedPrefix'),
  };
}
