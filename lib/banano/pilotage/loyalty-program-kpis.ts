/**
 * Agrège points distribués, tampons crédités et bons émis (événements fidélité)
 * sur jour / semaine ISO / mois calendaire — pour le pilotage et le PDF.
 */

import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type LoyaltyEventWithDeltas = {
  created_at: string;
  event_type: string;
  delta_points?: number | null;
  delta_stamps?: number | null;
};

export type LoyaltyProgramPeriodKpi = {
  /** Somme des delta_points > 0 sur les événements `earn_points`. */
  pointsDistributed: number;
  /** Somme des delta_stamps > 0 sur les événements `earn_stamps`. */
  stampsEarned: number;
  /** Nombre d'événements `voucher_issued` (bons générés). */
  vouchersGenerated: number;
};

export type LoyaltyProgramKpiBundle = {
  day: LoyaltyProgramPeriodKpi;
  week: LoyaltyProgramPeriodKpi;
  month: LoyaltyProgramPeriodKpi;
};

function emptyKpi(): LoyaltyProgramPeriodKpi {
  return { pointsDistributed: 0, stampsEarned: 0, vouchersGenerated: 0 };
}

export function sumLoyaltyKpisInRange(
  events: LoyaltyEventWithDeltas[],
  fromInclusive: Date,
  toInclusive: Date
): LoyaltyProgramPeriodKpi {
  const out = emptyKpi();
  const fromMs = fromInclusive.getTime();
  const toMs = toInclusive.getTime();
  for (const e of events) {
    const t = new Date(e.created_at).getTime();
    if (t < fromMs || t > toMs) continue;
    const et = e.event_type;
    if (et === 'earn_points') {
      const d = Math.max(0, Math.floor(Number(e.delta_points ?? 0)));
      out.pointsDistributed += d;
    } else if (et === 'earn_stamps') {
      const d = Math.max(0, Math.floor(Number(e.delta_stamps ?? 0)));
      out.stampsEarned += d;
    } else if (et === 'voucher_issued') {
      out.vouchersGenerated += 1;
    }
  }
  return out;
}

/**
 * @param now - référence « maintenant » (souvent `new Date()` côté serveur)
 */
export function computeLoyaltyProgramKpis(
  events: LoyaltyEventWithDeltas[],
  now: Date
): LoyaltyProgramKpiBundle {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return {
    day: sumLoyaltyKpisInRange(events, dayStart, dayEnd),
    week: sumLoyaltyKpisInRange(events, weekStart, weekEnd),
    month: sumLoyaltyKpisInRange(events, monthStart, monthEnd),
  };
}
