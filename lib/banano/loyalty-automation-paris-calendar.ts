import { differenceInCalendarDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const PARIS_TZ = 'Europe/Paris';

/** Placeholder demandé pour debug / extension future. */
export const getParisCalendar = () => {
  return { timezone: 'Europe/Paris', events: [] as const };
};

/**
 * Nombre de jours calendaires entre deux instants, selon le fuseau Europe/Paris
 * (aligné sur la logique « jour civil » des relances nouveaux membres).
 */
export function calendarDaysSinceInParis(from: Date, to: Date): number {
  const zFrom = toZonedTime(from, PARIS_TZ);
  const zTo = toZonedTime(to, PARIS_TZ);
  return differenceInCalendarDays(zTo, zFrom);
}
