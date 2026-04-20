import parsePhoneNumberFromString from 'libphonenumber-js/max';

/** Libellés courts UI pour les locales déduites du numéro. */
export const PREFERRED_LOCALE_LABEL: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
  es: 'Español',
  de: 'Deutsch',
  ja: '日本語',
};

/** Pays → locale REPUTEXA (aligné sur routing + cas frontaliers courants). */
const ALPHA2_TO_APP_LOCALE: Record<string, string> = {
  FR: 'fr',
  GF: 'fr',
  RE: 'fr',
  GP: 'fr',
  MQ: 'fr',
  YT: 'fr',
  MF: 'fr',
  BL: 'fr',
  PM: 'fr',
  WF: 'fr',
  PF: 'fr',
  NC: 'fr',
  IT: 'it',
  SM: 'it',
  VA: 'it',
  GB: 'en',
  GG: 'en',
  JE: 'en',
  IM: 'en',
  IE: 'en',
  MT: 'en',
  GI: 'en',
  ES: 'es',
  AD: 'es',
  DE: 'de',
  AT: 'de',
  LI: 'de',
  BE: 'fr',
  LU: 'fr',
  CH: 'fr',
  NL: 'en',
  PT: 'en',
};

/**
 * Déduit une locale produit (messages WhatsApp, etc.) à partir d’un numéro déjà en E.164.
 * Retourne `null` si parsing impossible ; sinon au minimum `fr` pour les pays non mappés.
 */
export function preferredAppLocaleFromE164(e164: string): string | null {
  const raw = e164?.trim();
  if (!raw.startsWith('+')) return null;
  try {
    const p = parsePhoneNumberFromString(raw);
    if (!p?.country) return null;
    return ALPHA2_TO_APP_LOCALE[p.country] ?? 'fr';
  } catch {
    return null;
  }
}
