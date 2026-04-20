import { createTranslator } from 'next-intl';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';

/** Traductions e-mails (namespace `EmailTemplates` dans messages/*.json, héritage fr). */
export function getEmailTemplatesTranslator(locale?: string | null) {
  const loc = normalizeEmailLocale(locale);
  const messages = getServerMessagesForLocale(loc);
  return createTranslator({ locale: loc, messages, namespace: 'EmailTemplates' });
}
