import { routing } from '@/i18n/routing';

type AppLocale = (typeof routing.locales)[number];

const LOCALES = new Set<string>(routing.locales);

function asAppLocale(value: string): AppLocale | null {
  return LOCALES.has(value) ? (value as AppLocale) : null;
}

/** Vercel / edge: ISO 3166-1 alpha-2 → interface locale (best effort). */
const COUNTRY_TO_LOCALE: Record<string, string> = {
  FR: 'fr',
  DE: 'de',
  AT: 'de',
  IT: 'it',
  ES: 'es',
  PT: 'en',
  BR: 'es',
  JP: 'en',
  CN: 'en',
  GB: 'en',
  IE: 'en',
  US: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IN: 'en',
  BE: 'fr',
  CH: 'de',
  NL: 'en',
  LU: 'fr',
  MX: 'es',
  AR: 'es',
};

function pickFromAcceptLanguage(header: string | null | undefined): AppLocale | null {
  if (!header?.trim()) return null;
  const candidates = header.split(',').map((part) => {
    const [tagRaw, qPart] = part.trim().split(';');
    const tag = (tagRaw ?? '').trim().toLowerCase();
    const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
    return { tag, q: Number.isFinite(q) ? q : 1 };
  });
  candidates.sort((a, b) => b.q - a.q);
  for (const { tag } of candidates) {
    if (!tag) continue;
    const base = tag.split('-')[0] ?? tag;
    const loc = asAppLocale(base);
    if (loc) return loc;
  }
  return null;
}

export function countryToAppLocale(code: string | null | undefined): AppLocale | null {
  if (!code) return null;
  const raw = COUNTRY_TO_LOCALE[code.toUpperCase()];
  return raw ? asAppLocale(raw) : null;
}

/**
 * First visit on `/` (no NEXT_LOCALE cookie): Accept-Language first, then IP country, then app default (en).
 */
export function inferLocaleForFirstVisit(request: Pick<Request, 'headers'>): AppLocale {
  const fromAccept = pickFromAcceptLanguage(request.headers.get('accept-language'));
  const fromGeo = countryToAppLocale(request.headers.get('x-vercel-ip-country'));
  if (fromAccept) return fromAccept;
  if (fromGeo) return fromGeo;
  return routing.defaultLocale;
}
