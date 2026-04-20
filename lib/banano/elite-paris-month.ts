/**
 * Mois calendaire « courant » et « précédent » en Europe/Paris (aligné mentions VIP / relances).
 */

export function parisCalendarMonthKeys(reference: Date = new Date()): {
  currentMonthKey: string;
  previousMonthKey: string;
} {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = dtf.formatToParts(reference);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const mo = Number(parts.find((p) => p.type === 'month')?.value);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    const fallback = monthInputValueUtc(reference);
    const [fy, fm] = fallback.split('-').map(Number);
    const prev = addMonthsUtc(fy, fm, -1);
    return { currentMonthKey: fallback, previousMonthKey: prev };
  }
  const currentMonthKey = `${y}-${String(mo).padStart(2, '0')}`;
  const prev = addMonthsUtc(y, mo, -1);
  return { currentMonthKey, previousMonthKey: prev };
}

function monthInputValueUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonthsUtc(year: number, month1to12: number, delta: number): string {
  const u = new Date(Date.UTC(year, month1to12 - 1 + delta, 1, 12, 0, 0, 0));
  const yy = u.getUTCFullYear();
  const mm = u.getUTCMonth() + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}
