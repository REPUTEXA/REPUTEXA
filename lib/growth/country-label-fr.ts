/**
 * Nom du pays en français (ISO 3166-1 alpha-2), pour l’admin War Room.
 */
export function growthCountryLabelFr(iso3166Alpha2: string | null | undefined): string {
  const code = (iso3166Alpha2 ?? '').trim().toUpperCase();
  if (!code) return '—';
  try {
    const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
    const name = dn.of(code);
    if (name) return name;
  } catch {
    /* ignore */
  }
  return code;
}
