/**
 * Détection de la langue à partir de l'indicatif téléphone (enregistrement / profil).
 * Utilisé lors de la saisie du numéro (signup ou paramètres) pour définir profiles.language.
 */

export type SupportedLocale = 'fr' | 'en' | 'it' | 'es' | 'de' | 'pt' | 'ja' | 'zh';

const PHONE_PREFIX_TO_LOCALE: Record<string, SupportedLocale> = {
  '33': 'fr',
  '39': 'it',
  '34': 'es',
  '49': 'de',
};

/**
 * Locale profil (`profiles.language`) à partir d'un numéro E.164.
 * Préfixes spécifiques : +351/+55 → pt, +81 → ja, +86 → zh ; +33/+39/+34/+49 comme ci-dessus ; sinon → en.
 * Sans « + », retour `fr` (comportement historique).
 */
export function getLanguageFromPhone(phone: string): SupportedLocale {
  const trimmed = (phone ?? '').trim();
  if (!trimmed || !trimmed.startsWith('+')) return 'fr';
  const digits = trimmed.slice(1).replace(/\D/g, '');
  if (digits.startsWith('351') || digits.startsWith('55')) return 'pt';
  if (digits.startsWith('81')) return 'ja';
  if (digits.startsWith('86')) return 'zh';
  const twoDigits = digits.slice(0, 2);
  if (twoDigits && PHONE_PREFIX_TO_LOCALE[twoDigits]) {
    return PHONE_PREFIX_TO_LOCALE[twoDigits];
  }
  return 'en';
}
