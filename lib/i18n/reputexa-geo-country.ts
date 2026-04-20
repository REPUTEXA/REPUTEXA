/** Set by middleware from Vercel `x-vercel-ip-country`; read on client for UK-specific copy. */
export const REPUTEXA_GEO_COUNTRY_COOKIE = 'reputexa_geo_country';

export function readGeoCountryFromDocumentCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const raw = `; ${document.cookie}`;
  const match = raw.split(`; ${REPUTEXA_GEO_COUNTRY_COOKIE}=`);
  if (match.length !== 2) return null;
  const v = match.pop()?.split(';').shift()?.trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) ? v : null;
}

export function isUkGeoCountry(code: string | null | undefined): boolean {
  const c = (code ?? '').toUpperCase();
  return c === 'GB' || c === 'UK';
}
