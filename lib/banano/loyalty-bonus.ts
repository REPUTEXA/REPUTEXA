/** Fuseau par défaut pour bornes des périodes bonus (produit FR). */
const DEFAULT_CALENDAR_TZ = 'Europe/Paris';

export type BananoLoyaltyBonusConfig = {
  enabled: boolean;
  startDate: string | null;
  endDate: string | null;
  /** Points forfait par achat (legacy / hors taux €) — ignoré si pointsExtraPerEuro > 0. */
  pointsExtraPerVisit: number;
  stampsExtraPerVisit: number;
  /** Points bonus par € TTC sur la période (additif au taux base). */
  pointsExtraPerEuro: number;
  stampsExtraPerEuro: number;
};

export function calendarYmdInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Indique si la date du jour (dans le fuseau) est dans [startDate, endDate] inclusive (chaînes YYYY-MM-DD).
 */
export function isBonusPeriodActive(
  startDate: string | null,
  endDate: string | null,
  now = new Date(),
  timeZone = DEFAULT_CALENDAR_TZ
): boolean {
  if (!startDate || !endDate) return false;
  if (startDate > endDate) return false;
  const today = calendarYmdInTz(now, timeZone);
  return today >= startDate && today <= endDate;
}

export function isLoyaltyBonusCreditingNow(
  bonus: BananoLoyaltyBonusConfig,
  now = new Date(),
  timeZone = DEFAULT_CALENDAR_TZ
): boolean {
  if (!bonus.enabled) return false;
  return isBonusPeriodActive(bonus.startDate, bonus.endDate, now, timeZone);
}

/**
 * Taux additionnel par € TTC (points ou tampons) : s’ajoute au taux de base.
 * Si dates début/fin absentes mais bonus activé et taux > 0, on applique (profils legacy / saisie incomplète).
 * Sinon, même fenêtre calendaire que la période bonus (fuseau Europe/Paris).
 */
export function isBonusPerEuroStackingActive(
  bonus: BananoLoyaltyBonusConfig,
  mode: 'points' | 'stamps',
  now = new Date(),
  timeZone = DEFAULT_CALENDAR_TZ
): boolean {
  if (!bonus.enabled) return false;
  const rate =
    mode === 'points'
      ? Math.max(0, Number(bonus.pointsExtraPerEuro) || 0)
      : Math.max(0, Number(bonus.stampsExtraPerEuro) || 0);
  if (rate <= 0) return false;
  if (!bonus.startDate?.trim() || !bonus.endDate?.trim()) return true;
  return isBonusPeriodActive(bonus.startDate, bonus.endDate, now, timeZone);
}

/** Crédit effectif pour un achat (un seul mode actif côté merchant). */
export function effectiveEarnCredit(
  input: {
    mode: 'points' | 'stamps';
    pointsPerVisit: number;
    stampsPerVisit: number;
    bonus: BananoLoyaltyBonusConfig;
  },
  now = new Date(),
  timeZone = DEFAULT_CALENDAR_TZ
): { points: number; stamps: number } {
  const active = isLoyaltyBonusCreditingNow(input.bonus, now, timeZone);
  const ptsX = active ? input.bonus.pointsExtraPerVisit : 0;
  const stmX = active ? input.bonus.stampsExtraPerVisit : 0;
  if (input.mode === 'points') {
    return { points: input.pointsPerVisit + ptsX, stamps: 0 };
  }
  return { points: 0, stamps: input.stampsPerVisit + stmX };
}
