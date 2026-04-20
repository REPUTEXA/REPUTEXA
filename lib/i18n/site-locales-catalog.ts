/**
 * Source unique pour les langues du site (URL /{locale}, e-mails basés sur messages/*.json).
 *
 * - `gateCountryCode` : si défini, la page publique /{code} n’est servie que lorsque le marché
 *   correspondant a `publicSiteLocaleEnabled` dans la War Room (fr + en : toujours publics).
 *
 * Pour ajouter une langue (ex. `ko`) :
 * 1. Ajouter une entrée ici + fichier `messages/ko.json` (même structure que `fr.json`, clés manquantes héritent du fr).
 * 2. Ajouter `ko` à `SITE_LOCALE_CODES` et `SITE_LOCALE_META` (même fichier).
 * 3. Optionnel : pays de garde + ligne `growth_country_configs` (script ensure-default) si /ko doit être derrière un interrupteur.
 * 4. Déployer (Next.js doit connaître la locale au build pour `generateStaticParams`).
 * 5. Lancer les scripts de fusion `locale-partials` si vous utilisez des patchs (auth, legal, etc.).
 *
 * Feuille de route détaillée (étapes 1–12, IA optionnelle) : Admin → Babel Guardian.
 */

/** @babel-anchor site-locale-codes — Smart-merge : insère des codes triés dans ce tableau */
export const SITE_LOCALE_CODES = ['fr', 'en', 'en-gb', 'es', 'de', 'it', 'pt', 'ja', 'zh'] as const;

export type SiteLocaleCode = (typeof SITE_LOCALE_CODES)[number];

export const SITE_LOCALE_META: Record<
  SiteLocaleCode,
  { labelFr: string; gateCountryCode: string | null }
> = {
  fr: { labelFr: 'Français', gateCountryCode: null },
  en: { labelFr: 'Anglais (US)', gateCountryCode: null },
  'en-gb': { labelFr: 'Anglais (UK)', gateCountryCode: 'GB' },
  es: { labelFr: 'Espagnol', gateCountryCode: 'ES' },
  de: { labelFr: 'Allemand', gateCountryCode: 'DE' },
  it: { labelFr: 'Italien', gateCountryCode: 'IT' },
  pt: { labelFr: 'Portugais', gateCountryCode: 'PT' },
  ja: { labelFr: 'Japonais', gateCountryCode: 'JP' },
  zh: { labelFr: 'Chinois (simplifié)', gateCountryCode: 'CN' },
  /* @babel-anchor site-locale-meta-insert */
};

/** Locales « expansion » : liées à un pays dans la War Room (`publicSiteLocaleEnabled`). */
export function localeToGateCountryCode(locale: string): string | undefined {
  const code = locale.toLowerCase() as SiteLocaleCode;
  if (!(SITE_LOCALE_CODES as readonly string[]).includes(code)) return undefined;
  const g = SITE_LOCALE_META[code].gateCountryCode;
  return g ?? undefined;
}

/** Tag BCP 47 pour `Intl` / `toLocaleDateString` (UI dashboard, pas les e-mails). */
export const SITE_LOCALE_TO_INTL_DATE: Record<SiteLocaleCode, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  'en-gb': 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

export function siteLocaleToIntlDateTag(locale: string): string {
  const code = locale.toLowerCase() as SiteLocaleCode;
  if ((SITE_LOCALE_CODES as readonly string[]).includes(code)) {
    return SITE_LOCALE_TO_INTL_DATE[code];
  }
  return 'en-US';
}

/** Libellé natif (nom de la langue dans sa graphie) — sélecteurs header / footer. */
export const SITE_LOCALE_NATIVE_LABEL: Record<SiteLocaleCode, string> = {
  fr: 'Français',
  en: 'English',
  'en-gb': 'English (UK)',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  ja: '日本語',
  zh: '简体中文',
};

/** Badge court marché / région (pas le code URL ; ex. `en-gb` → `GB`). */
export const SITE_LOCALE_SELECTOR_BADGE: Record<SiteLocaleCode, string> = {
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

export const SITE_LOCALE_FLAG_EMOJI: Record<SiteLocaleCode, string> = {
  fr: '🇫🇷',
  en: '🇺🇸',
  'en-gb': '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

/** Région affichée dans le footer « Region (Language) » (libellés EN fixes, cohérents avec l’existant). */
export const SITE_LOCALE_FOOTER_REGION_EN: Record<SiteLocaleCode, string> = {
  fr: 'France',
  en: 'United States',
  'en-gb': 'United Kingdom',
  es: 'Spain',
  de: 'Germany',
  it: 'Italy',
  pt: 'Portugal',
  ja: 'Japan',
  zh: 'China',
};
