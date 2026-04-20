import { createTranslator } from 'next-intl';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/**
 * Libellés pass Wallet (Apple / Google) selon la langue du membre (`preferred_locale` ou défaut fr).
 */
export function createWalletPassTranslator(memberLocale: string | null | undefined) {
  const loc = normalizeAppLocale(memberLocale ?? undefined);
  const messages = getServerMessagesForLocale(loc);
  return createTranslator({ locale: loc, messages, namespace: 'WalletPass' });
}
