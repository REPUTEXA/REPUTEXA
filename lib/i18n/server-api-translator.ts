import { createTranslator } from 'next-intl';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/** Traductions serveur (e-mails, erreurs API) alignées sur `messages/*.json`. */
export function createServerTranslator(namespace: string, locale?: string | null) {
  const loc = normalizeAppLocale(locale ?? undefined);
  const messages = getServerMessagesForLocale(loc);
  return createTranslator({ locale: loc, messages, namespace });
}
