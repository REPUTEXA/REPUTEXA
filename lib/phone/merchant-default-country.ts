import type { CountryCode } from 'libphonenumber-js';
import { getCountries } from 'libphonenumber-js';
import type { Country } from 'react-phone-number-input';
import { getRegionCodeForSiteLocale } from '@/lib/i18n/locale-region';

const VALID_COUNTRIES = new Set<string>(getCountries());

/** Pays texte libre (profil) → code ISO2 pour libphonenumber. */
const COUNTRY_NAME_TO_CODE: Record<string, CountryCode> = {
  france: 'FR',
  frankreich: 'FR',
  deutschland: 'DE',
  germany: 'DE',
  allemagne: 'DE',
  alemania: 'ES',
  spain: 'ES',
  espagne: 'ES',
  españa: 'ES',
  italy: 'IT',
  italie: 'IT',
  italia: 'IT',
  portugal: 'PT',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  'u.s.': 'US',
  'u.s.a.': 'US',
  'royaume-uni': 'GB',
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  belgique: 'BE',
  belgium: 'BE',
  belgien: 'BE',
  suisse: 'CH',
  switzerland: 'CH',
  schweiz: 'CH',
  'österreich': 'AT',
  austria: 'AT',
  autriche: 'AT',
  nederland: 'NL',
  netherlands: 'NL',
  'pays-bas': 'NL',
  poland: 'PL',
  pologne: 'PL',
  polska: 'PL',
  japan: 'JP',
  japon: 'JP',
  日本: 'JP',
  china: 'CN',
  chine: 'CN',
  中国: 'CN',
};

function tryIso2FromCountryField(raw: string | null | undefined): CountryCode | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) {
    const u = t.toUpperCase();
    if (VALID_COUNTRIES.has(u)) return u as CountryCode;
    return null;
  }
  const key = t.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const mapped = COUNTRY_NAME_TO_CODE[key];
  if (mapped && VALID_COUNTRIES.has(mapped)) return mapped;
  return null;
}

/**
 * Pays par défaut pour parser les numéros côté API (fidélité, etc.) :
 * champ `profiles.country` si reconnu, sinon région déduite de `profiles.language`.
 */
export function defaultPhoneCountryFromMerchantProfile(params: {
  country: string | null | undefined;
  language: string | null | undefined;
}): Country {
  const fromField = tryIso2FromCountryField(params.country);
  if (fromField) return fromField as Country;
  return getRegionCodeForSiteLocale(params.language ?? 'fr');
}
