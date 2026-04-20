/**
 * Emails onboarding : traductions depuis messages/*.json (namespace Emails.Onboarding).
 * Équivalent serveur de useTranslations('Emails.Onboarding').
 */
import { createTranslator } from 'next-intl';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

export function createOnboardingEmailTranslator(rawLocale: string | null | undefined) {
  const locale = normalizeAppLocale(rawLocale);
  const messages = getServerMessagesForLocale(locale);
  return createTranslator({
    locale,
    namespace: 'Emails.Onboarding',
    messages,
  });
}
