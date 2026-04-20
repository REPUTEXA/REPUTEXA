import { endOfMonth, format } from 'date-fns';
import { calendarYmdInTz } from '@/lib/banano/loyalty-bonus';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';

const TZ = 'Europe/Paris';

/** Vrai si nous sommes le 1er du mois (calendrier Paris). */
export function isFirstOfMonthParis(now: Date): boolean {
  return calendarYmdInTz(now, TZ).slice(8, 10) === '01';
}

/**
 * Mois civil précédent (Paris) : bornes UTC alignées sur le 1er à minuit UTC du mois précédent et du mois courant.
 * Suffisant pour agréger les événements stockés en timestamptz (même logique que le reste du pilotage).
 */
export function previousMonthWindowForVipParis(now: Date): {
  fromIso: string;
  toExclusiveIso: string;
  vipMonthKey: string;
  prevStart: Date;
  last: Date;
} | null {
  const ymd = calendarYmdInTz(now, TZ);
  if (ymd.slice(8, 10) !== '01') return null;
  const [y0, m0] = ymd.split('-').map(Number);
  const py = m0 === 1 ? y0 - 1 : y0;
  const pm = m0 === 1 ? 12 : m0 - 1;
  const prevStart = new Date(Date.UTC(py, pm - 1, 1, 0, 0, 0));
  const toExclusive = new Date(Date.UTC(y0, m0 - 1, 1, 0, 0, 0));
  const last = endOfMonth(prevStart);
  const vipMonthKey = `${py}-${String(pm).padStart(2, '0')}`;
  return {
    fromIso: prevStart.toISOString(),
    toExclusiveIso: toExclusive.toISOString(),
    vipMonthKey,
    prevStart,
    last,
  };
}

/** Libellé de période « du … au … » / « … – … » selon la locale du marchand. */
export function formatVipPeriodRangeLabel(
  prevStart: Date,
  last: Date,
  appLocale: string,
  t: (key: string, values: { from: string; to: string }) => string
): string {
  const loc = dateFnsLocaleForApp(appLocale);
  const fromStr = format(prevStart, 'd MMMM yyyy', { locale: loc });
  const toStr = format(last, 'd MMMM yyyy', { locale: loc });
  return t('vip_period_range', { from: fromStr, to: toStr });
}
