/** Clé mensuelle Europe/Paris pour idempotence des bons collaborateurs (YYYY-MM). */
export function staffAllowanceMonthKeyParis(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  let y = '';
  let m = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value.padStart(2, '0');
  }
  return y && m ? `${y}-${m}` : d.toISOString().slice(0, 7);
}
