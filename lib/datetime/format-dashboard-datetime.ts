/**
 * Formate une date UTC / ISO dans le fuseau établissement + locale UI (Intl).
 */
export function formatDateInUserTimeZone(
  intlLocaleTag: string,
  timeZone: string,
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlLocaleTag, { timeZone, ...options }).format(d);
}
