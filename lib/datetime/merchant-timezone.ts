/**
 * Fuseau « établissement » : affichage dashboard + fenêtre de courtoisie crons (WhatsApp / e-mails).
 * Repli historique Europe/Paris si valeur absente ou IANA invalide.
 */

export const MERCHANT_TIMEZONE_FALLBACK = 'Europe/Paris';

export const MERCHANT_COURTESY_WINDOW_START_H = 9;
export const MERCHANT_COURTESY_WINDOW_END_H = 21;

export function isValidIanaTimeZone(tz: string): boolean {
  const s = tz.trim();
  if (!s) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: s });
    return true;
  } catch {
    return false;
  }
}

export function resolveMerchantTimeZone(stored: string | null | undefined): string {
  const s = (stored ?? '').trim();
  if (s && isValidIanaTimeZone(s)) return s;
  return MERCHANT_TIMEZONE_FALLBACK;
}

export function getZonedDateTimeParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

/** 09h inclus — 21h exclus, heure locale du fuseau marchand. */
export function isMerchantCourtesyWindow(date: Date, timeZone: string): boolean {
  const { hour } = getZonedDateTimeParts(date, timeZone);
  return hour >= MERCHANT_COURTESY_WINDOW_START_H && hour < MERCHANT_COURTESY_WINDOW_END_H;
}
