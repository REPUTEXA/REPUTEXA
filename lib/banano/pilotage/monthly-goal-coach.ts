import { differenceInCalendarDays, endOfMonth, startOfMonth } from 'date-fns';
import type { PilotageTranslate } from '@/lib/banano/pilotage/build-pilotage-dashboard';

export type MonthlyFinancialCoach = {
  goalCents: number;
  revenueCents: number;
  progressPercent: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number;
  projectedEndCents: number;
  shortfallCents: number | null;
  coachLine: string;
  warCouncilLine: string;
  forecastLine: string;
};

/**
 * Objectif CA du mois + projection linéaire + messages coach (sans IA).
 * Textes : `Dashboard.bananoPilotageCore` via `pilotageT`.
 */
export function buildMonthlyFinancialCoach(
  now: Date,
  goalCents: number,
  revenueMonthCents: number,
  options: { locale: string; pilotageT: PilotageTranslate }
): MonthlyFinancialCoach {
  const { locale, pilotageT } = options;

  const fmtEur = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const daysInMonth = differenceInCalendarDays(end, start) + 1;
  const dayOfMonth = Math.min(daysInMonth, differenceInCalendarDays(now, start) + 1);
  const daysLeft = Math.max(0, differenceInCalendarDays(end, now));

  const progressPercent = Math.min(100, Math.round((revenueMonthCents / goalCents) * 100));

  const projectedEndCents =
    dayOfMonth > 0 ? Math.round((revenueMonthCents / dayOfMonth) * daysInMonth) : 0;
  const shortfallRaw = goalCents - projectedEndCents;
  const shortfallCents = shortfallRaw > 0 ? shortfallRaw : null;

  const coachLine =
    pilotageT('monthly_coach_intro', {
      progressPercent,
      revenue: fmtEur(revenueMonthCents),
      goal: fmtEur(goalCents),
      daysLeft,
    }) +
    (shortfallCents != null
      ? pilotageT('monthly_coach_shortfall', { shortfall: fmtEur(shortfallCents) })
      : pilotageT('monthly_coach_on_track'));

  let warCouncilLine: string;
  if (shortfallCents != null && shortfallCents > goalCents * 0.03) {
    warCouncilLine = pilotageT('monthly_war_gap');
  } else if (progressPercent >= 100) {
    warCouncilLine = pilotageT('monthly_war_done');
  } else {
    warCouncilLine = pilotageT('monthly_war_default');
  }

  const ratio = goalCents > 0 ? projectedEndCents / goalCents : 0;
  const vsGoalPct = goalCents > 0 ? Math.round((ratio - 1) * 100) : 0;
  const vsGoalSigned = vsGoalPct >= 0 ? `+${vsGoalPct}` : String(vsGoalPct);

  const forecastLine =
    dayOfMonth > 0 && daysInMonth > 0
      ? pilotageT('monthly_forecast_progress', {
          projected: fmtEur(projectedEndCents),
          goal: fmtEur(goalCents),
          vsGoalSigned,
        })
      : pilotageT('monthly_forecast_simple', {
          projected: fmtEur(projectedEndCents),
          goal: fmtEur(goalCents),
        });

  return {
    goalCents,
    revenueCents: revenueMonthCents,
    progressPercent,
    daysInMonth,
    dayOfMonth,
    daysLeft,
    projectedEndCents,
    shortfallCents,
    coachLine,
    warCouncilLine,
    forecastLine,
  };
}
