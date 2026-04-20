/**
 * Indique que l’utilisateur a choisi explicitement une devise dans le sélecteur.
 * Le choix est **scopé à la langue / préfixe de site** (`ja`, `fr`, …) : une préférence
 * enregistrée sur `/fr` ne doit pas forcer EUR sur `/ja` si l’utilisateur ouvre le japonais directement.
 * Un changement de langue via le menu efface ce drapeau et réaligne le cookie sur la locale.
 */
const STORAGE_KEY = 'billing-currency-manual';
const STORAGE_LOCALE_KEY = 'billing-currency-manual-for-locale';

export function setBillingCurrencyManualPreference(active: boolean, forSiteLocale?: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (active && forSiteLocale) {
      localStorage.setItem(STORAGE_KEY, '1');
      localStorage.setItem(STORAGE_LOCALE_KEY, forSiteLocale);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_LOCALE_KEY);
    }
  } catch {
    /* navigation privée / quota */
  }
}

export function readBillingCurrencyManualPreference(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Locale du site (code next-intl) pour laquelle la préférence manuelle a été posée. */
export function readBillingCurrencyManualForSiteLocale(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(STORAGE_LOCALE_KEY);
    return v != null && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function clearBillingCurrencyManualPreference(): void {
  setBillingCurrencyManualPreference(false);
}
