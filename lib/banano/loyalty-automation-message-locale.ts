import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/** Placeholder demandé pour debug / extension future. */
export const getLoyaltyMessageLocale = (locale: string) => {
  return { greeting: 'Bonjour', locale: normalizeAppLocale(locale) };
};

/**
 * Locale effective pour composer les messages d’automation WhatsApp :
 * préférence membre si renseignée, sinon langue marchand.
 */
export function messageLocaleForAutomation(
  merchantLocale: string,
  memberPreferredLocale: string | null | undefined
): string {
  const pref = (memberPreferredLocale ?? '').trim();
  if (pref) return normalizeAppLocale(pref);
  return normalizeAppLocale(merchantLocale);
}
