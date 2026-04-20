import {
  SITE_LOCALE_CODES,
  siteLocaleToIntlDateTag,
  type SiteLocaleCode,
} from '@/lib/i18n/site-locales-catalog';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

const LOCALE_TO_CC: Record<SiteLocaleCode, string> = {
  fr: 'FR',
  en: 'US',
  'en-gb': 'GB',
  es: 'ES',
  de: 'DE',
  it: 'IT',
  pt: 'PT',
  ja: 'JP',
  zh: 'CN',
};

/** Pays (texte profil) → code ISO2 — couverture large mais pas exhaustive. */
const COUNTRY_TEXT_TO_CC: Record<string, string> = {
  france: 'FR',
  fr: 'FR',
  allemagne: 'DE',
  germany: 'DE',
  deutschland: 'DE',
  espagne: 'ES',
  spain: 'ES',
  españa: 'ES',
  italie: 'IT',
  italy: 'IT',
  italia: 'IT',
  portugal: 'PT',
  japon: 'JP',
  japan: 'JP',
  chine: 'CN',
  china: 'CN',
  'états-unis': 'US',
  'etats-unis': 'US',
  usa: 'US',
  'united states': 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'royaume-uni': 'GB',
  angleterre: 'GB',
  england: 'GB',
  belgique: 'BE',
  belgium: 'BE',
  suisse: 'CH',
  switzerland: 'CH',
  canada: 'CA',
  brésil: 'BR',
  brazil: 'BR',
  mexique: 'MX',
  mexico: 'MX',
  maroc: 'MA',
  morocco: 'MA',
  algérie: 'DZ',
  algeria: 'DZ',
  tunisie: 'TN',
  tunisia: 'TN',
  corée: 'KR',
  'south korea': 'KR',
  australie: 'AU',
  australia: 'AU',
  inde: 'IN',
  india: 'IN',
};

function normalizeCountryKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Déduit un code pays ISO2 pour le drapeau (profil + locale de rédaction). */
export function resolveAuthorCountryCode(
  countryText: string | null | undefined,
  authorLocale: string | null | undefined,
  profileLocale: string | null | undefined
): string {
  const fromText = countryText?.trim();
  if (fromText) {
    if (/^[A-Za-z]{2}$/.test(fromText)) {
      return fromText.toUpperCase();
    }
    const k = normalizeCountryKey(fromText);
    if (COUNTRY_TEXT_TO_CC[k]) return COUNTRY_TEXT_TO_CC[k];
  }
  const loc = normalizeAppLocale(authorLocale || profileLocale || 'fr') as SiteLocaleCode;
  if ((SITE_LOCALE_CODES as readonly string[]).includes(loc)) {
    return LOCALE_TO_CC[loc];
  }
  return 'FR';
}

export function countryCodeToFlagEmoji(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '🏳️';
  const base = 0x1f1e6;
  return String.fromCodePoint(base + c.charCodeAt(0) - 65, base + c.charCodeAt(1) - 65);
}

/** Mur communautaire : afficher seulement le prénom (premier mot du nom stocké). */
export function publicSuggestionAuthorFirstName(
  storedFullNameOrLabel: string | null | undefined
): string {
  const raw = String(storedFullNameOrLabel ?? '').trim();
  if (!raw) return '';
  const first = raw.split(/\s+/)[0]?.trim() ?? '';
  return first;
}

/** Nom du pays / territoire ISO2 pour l’UI (langue du dashboard). */
export function countryCodeToLocalizedRegionName(code: string, uiLocale: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try {
    const intlTag = siteLocaleToIntlDateTag(uiLocale);
    const dn = new Intl.DisplayNames([intlTag], { type: 'region' });
    return dn.of(c) ?? c;
  } catch {
    return c;
  }
}
