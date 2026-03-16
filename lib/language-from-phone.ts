/**
 * Détection de la langue à partir de l'indicatif téléphone (enregistrement / profil).
 * Utilisé lors de la saisie du numéro (signup ou paramètres) pour définir profiles.language.
 */

export type SupportedLocale = 'fr' | 'en' | 'it' | 'es' | 'de';

const PHONE_PREFIX_TO_LOCALE: Record<string, SupportedLocale> = {
  '33': 'fr',
  '39': 'it',
  '34': 'es',
  '49': 'de',
};

/**
 * Retourne la locale (fr, it, es, de, en) à partir d'un numéro au format E.164 (commence par +).
 * +33 -> fr, +39 -> it, +34 -> es, +49 -> de, tout autre (+44, +1, etc.) -> en.
 * Sans indicatif international, on ne modifie pas la langue (retour 'fr' par défaut).
 */
export function getLanguageFromPhone(phone: string): SupportedLocale {
  const trimmed = (phone ?? '').trim();
  if (!trimmed || !trimmed.startsWith('+')) return 'fr';
  const digits = trimmed.slice(1).replace(/\D/g, '');
  const twoDigits = digits.slice(0, 2);
  if (twoDigits && PHONE_PREFIX_TO_LOCALE[twoDigits]) {
    return PHONE_PREFIX_TO_LOCALE[twoDigits];
  }
  return 'en';
}
