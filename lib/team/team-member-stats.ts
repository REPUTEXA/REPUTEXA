/** Début de journée UTC (compteur scans « aujourd’hui » aligné serveur). */
export function utcDayStartIso(d = new Date()): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}

/** Lundi 00:00 UTC de la semaine courante (compteur tâches « cette semaine »). */
export function utcMondayWeekStartIso(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const diffFromMonday = (dow + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diffFromMonday);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}
