import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';

const LOCALES_LOWER = new Map(
  routing.locales.map((loc) => [loc.toLowerCase(), loc] as const)
);

/** Résout le segment `[locale]` vers une locale supportée, ou `null` si inconnu. */
export function resolveLocaleParam(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const seg = raw.trim().normalize('NFC');
  return LOCALES_LOWER.get(seg.toLowerCase()) ?? null;
}

/**
 * Redirection 308 si le premier segment d’URL est une locale connue mais pas sa forme canonique
 * (ex. /Fr/..., espaces, casse différente pour en-gb). Évite que `[locale]` ne matche pas → 404 Next par défaut.
 */
export function redirectIfLocaleSegmentNonCanonical(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const m = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (!m) return null;
  const rawSeg = m[1];
  const rest = m[2] ?? '';
  const seg = rawSeg.trim().normalize('NFC');
  const canonical = LOCALES_LOWER.get(seg.toLowerCase());
  if (!canonical) return null;
  if (seg === canonical) return null;
  const u = request.nextUrl.clone();
  u.pathname = `/${canonical}${rest}`;
  return NextResponse.redirect(u, 308);
}
