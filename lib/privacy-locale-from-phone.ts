/**
 * Associe un numéro (E.164 ou saisie locale) à une locale du site pour les pages légales.
 * Aligné sur `routing.locales`.
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { routing } from '@/i18n/routing';

const SUPPORTED = new Set<string>(routing.locales);

/** ISO 3166-1 alpha-2 → locale légale (politique, formulaire clients finaux, affiche). */
const COUNTRY_TO_LEGAL_LOCALE: Record<string, string> = {
  FR: 'fr',
  GF: 'fr',
  GP: 'fr',
  MQ: 'fr',
  RE: 'fr',
  YT: 'fr',
  PF: 'fr',
  NC: 'fr',
  BL: 'fr',
  MF: 'fr',
  PM: 'fr',
  WF: 'fr',
  IT: 'it',
  VA: 'it',
  SM: 'it',
  DE: 'de',
  AT: 'de',
  LI: 'de',
  ES: 'es',
  AD: 'es',
  MX: 'es',
  AR: 'es',
  CO: 'es',
  CL: 'es',
  GB: 'en',
  US: 'en',
  IE: 'en',
  AU: 'en',
  NZ: 'en',
  CA: 'en',
  IN: 'en',
  SG: 'en',
  ZA: 'en',
  BE: 'fr',
  LU: 'fr',
  MC: 'fr',
  /** Suisse : trois langues officielles — italien couvre aussi la Suisse italienne ; sinon FR souvent utilisée pour les docs légales. */
  CH: 'fr',
  JP: 'ja',
  KR: 'en',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  MO: 'zh',
  BR: 'pt',
  PT: 'pt',
  AO: 'pt',
  MZ: 'pt',
  NL: 'en',
  PL: 'en',
  SE: 'en',
  NO: 'en',
  DK: 'en',
  FI: 'en',
  GR: 'en',
  CZ: 'en',
  RO: 'en',
  HU: 'en',
};

function defaultCountryFromUiLocale(uiLocale: string): CountryCode {
  switch (uiLocale) {
    case 'de':
      return 'DE';
    case 'it':
      return 'IT';
    case 'es':
      return 'ES';
    case 'en':
      return 'GB';
    case 'pt':
      return 'PT';
    case 'ja':
      return 'JP';
    case 'zh':
      return 'CN';
    default:
      return 'FR';
  }
}

/**
 * Déduit la locale des URLs légales à partir du téléphone saisi.
 * @param phone - Saisie utilisateur (+39…, 06… avec contexte FR, etc.)
 * @param fallbackLocale - Locale de la page courante (ex. useLocale())
 */
export function getPrivacyLocaleFromPhone(phone: string | undefined | null, fallbackLocale: string): string {
  const fb = SUPPORTED.has(fallbackLocale) ? fallbackLocale : routing.defaultLocale;
  const raw = (phone ?? '').trim();
  if (!raw) return fb;

  const defaultCountry = defaultCountryFromUiLocale(fb);
  const parsed = parsePhoneNumberFromString(raw, defaultCountry);
  if (!parsed?.country) return fb;

  const mapped = COUNTRY_TO_LEGAL_LOCALE[parsed.country];
  if (mapped && SUPPORTED.has(mapped)) return mapped;
  return fb;
}
