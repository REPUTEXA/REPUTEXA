import { routing } from '@/i18n/routing';

const VALID_LOCALES = [...routing.locales];
const LOCALE_SEG = VALID_LOCALES.join('|');

/**
 * Chemins accessibles sans session Supabase — aligné strictement sur `middleware.ts`.
 * Utilisé par la bannière cookies (même périmètre que « site public »).
 */
const PUBLIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/?$/,
  new RegExp(`^\\/(${LOCALE_SEG})(\\/?)$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/sign-up(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/sign-in(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/login$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/signup$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/register$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/confirm-email$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/banano-pin-reset$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/banano\\/join\\/[^/]+$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/join\\/[^/]+$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/verify(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/auth\\/callback`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/choose-plan$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/pricing$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/contact$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/blog(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/api$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/guides(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/about$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/careers$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/investors$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/sustainability$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/statuts$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/sitemap$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/legal(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/data-rights(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/privacy$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/terms$`),
  /^\/sign-up(\/.*)?$/,
  /^\/pricing$/,
  /^\/sign-in(\/.*)?$/,
  /^\/login$/,
  /^\/signup$/,
  /^\/register$/,
  /^\/confirm-email$/,
  /^\/verify(\/.*)?$/,
  /^\/auth\/callback/,
  /^\/choose-plan$/,
  new RegExp(`^\\/(${LOCALE_SEG})\\/quick-reply\\/[^/]+$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/newsletter(\\/.*)?$`),
  new RegExp(`^\\/(${LOCALE_SEG})\\/defi-reputexa\\/equipe\\/[^/]+$`),
];

export function isPublicSitePathname(pathname: string): boolean {
  const p = pathname.replace(/^\/+/, '/');
  return PUBLIC_ROUTE_PATTERNS.some((re) => re.test(p));
}
