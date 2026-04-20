import { getCountries } from 'libphonenumber-js';
import type { Country } from 'react-phone-number-input';

/**
 * Aligné sur le sélecteur d’indicatif téléphonique : la langue du site suggère le pays par défaut.
 */
export const LOCALE_TO_REGION: Record<string, Country> = {
  fr: 'FR',
  /** Aligné sur `SITE_LOCALE_TO_INTL_DATE.en` (`en-US`) : indicatif +31 → +1, formats US. */
  en: 'US',
  es: 'ES',
  de: 'DE',
  it: 'IT',
  pt: 'PT',
  ja: 'JP',
  zh: 'CN',
};

const FALLBACK: Country = 'FR';

export function getRegionCodeForSiteLocale(siteLocale: string): Country {
  const lower = siteLocale.toLowerCase();
  if (lower === 'en-gb') return 'GB';
  const key = lower.split('-')[0] ?? '';
  return LOCALE_TO_REGION[key] ?? FALLBACK;
}

/** Libellé pays pour l’UI (selon la langue active next-intl). */
export function getCountryDisplayName(siteLocale: string, region: string): string {
  try {
    const dn = new Intl.DisplayNames([siteLocale], { type: 'region' });
    return dn.of(region) ?? region;
  } catch {
    return region;
  }
}

/**
 * Codes pays « monde » : `Intl.supportedValuesOf('region')` (ISO 3166-1 alpha-2),
 * fusionné avec `getCountries()` (libphonenumber) pour rester aligné sur le téléphone.
 */
export function getAllWorldRegionCodes(): string[] {
  const set = new Set<string>();

  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const supportedValuesOf = Intl.supportedValuesOf as (key: string) => string[];
      for (const r of supportedValuesOf('region')) {
        if (typeof r === 'string' && /^[A-Za-z]{2}$/.test(r)) {
          set.add(r.toUpperCase());
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const c of getCountries()) {
    set.add(c);
  }

  if (set.size === 0) {
    return [...getCountries()];
  }

  return [...set];
}

export function getSortedSignupCountryOptions(siteLocale: string): { code: string; label: string }[] {
  const codes = getAllWorldRegionCodes();
  const opts = codes.map((code) => ({
    code,
    label: getCountryDisplayName(siteLocale, code) || code,
  }));
  opts.sort((a, b) => a.label.localeCompare(b.label, siteLocale, { sensitivity: 'base' }));
  return opts;
}
