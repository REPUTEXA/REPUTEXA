import {
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from 'date-fns';
import {
  sumLoyaltyKpisInRange,
  type LoyaltyEventWithDeltas,
} from '@/lib/banano/pilotage/loyalty-program-kpis';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { fetchBananoStaffMonthStats } from '@/lib/banano/staff-month-stats';
import type { LoyaltyEventRow, MemberRow } from '@/lib/banano/pilotage/build-pilotage-dashboard';
import { computeRetentionAndWeekdayHeat } from '@/lib/banano/pilotage/retention-weekday';
import { fetchAutomationRelanceSnapshotForRange } from '@/lib/banano/pilotage/automation-relance-snapshot';
import {
  fetchLoyaltyMonthCostBreakdown,
  type LoyaltyMonthCostBreakdown,
} from '@/lib/banano/pilotage/loyalty-month-costs';
import type {
  RetentionFunnelDetail,
  RetentionFunnelSnapshot,
  WeekdayHeatCell,
} from '@/lib/banano/pilotage/types';
import {
  aggregateCashIngestionRows,
  type PilotageCashStaffRow,
  type PilotageCashTerminalRow,
} from '@/lib/banano/pilotage/cash-ingest-aggregates';

export type BananoStaffPerformancePdfRow = {
  display_name: string;
  ticketsEncaisse: number;
  clientsCreated: number;
  revenueCents: number;
  transformPercent: number;
  avgBasketCents: number;
  googlePositiveReviews: number;
};

export type BananoPerformanceMonthStats = {
  monthStartIso: string;
  /** Libellé mois (ex. « février 2026 » / « February 2026 ») selon la locale marchand. */
  monthLabel: string;
  revenueCents: number;
  prevRevenueCents: number;
  revenueChangePct: number | null;
  newMembersCount: number;
  newMembersRevenueCents: number;
  visitCount: number;
  googleAvgThis: number;
  googleAvgPrev: number;
  googleRatingDelta: number | null;
  googleReviewCountThis: number;
  hasRevenueData: boolean;
  retentionFunnel: RetentionFunnelSnapshot;
  staffPerformance: {
    rows: BananoStaffPerformancePdfRow[];
  };
  /** Agrégat fidélité sur le mois du rapport (événements `banano_loyalty_events`). */
  loyaltyMonth: {
    pointsDistributed: number;
    stampsEarned: number;
    vouchersGenerated: number;
  };
  /** Relances WhatsApp (même périmètre que le pilotage opérationnel). */
  whatsappRelances: {
    rulesEnabled: {
      lost_client: boolean;
      birthday: boolean;
      vip_of_month: boolean;
      new_client_welcome: boolean;
    };
    sendsMonth: {
      lost_client: number;
      birthday: number;
      vip_of_month: number;
      new_client_welcome: number;
    };
    attributedRevenueCents: number;
    aggregateSendsMonth: number;
  };
  loyaltyValue: {
    costBreakdown: LoyaltyMonthCostBreakdown;
    revenueNetAfterFixedVoucherCents: number;
    revenueToFixedRedemptionRatio: number | null;
  };
  weekdayHeat: WeekdayHeatCell[];
  retentionFunnelDetail: RetentionFunnelDetail;
  /** Tickets agent sync sur le mois du rapport (ticket_at), par terminal. */
  cashTerminalMonth: PilotageCashTerminalRow[];
  /** Performance équipiers (staff_name) sur les tickets sync du mois. */
  cashStaffMonth: PilotageCashStaffRow[];
};

function monthYearForLocale(d: Date, appLocale: string): string {
  return format(d, 'MMMM yyyy', { locale: dateFnsLocaleForApp(appLocale) });
}

/**
 * Agrège les métriques Banano + avis Google pour un mois calendaire donné.
 */
export async function collectBananoPerformanceMonthStats(
  supabase: SupabaseClient,
  userId: string,
  periodStart: Date,
  appLocale = 'fr'
): Promise<BananoPerformanceMonthStats> {
  const from = startOfMonth(periodStart);
  const to = endOfMonth(periodStart);
  const prevFrom = startOfMonth(subMonths(periodStart, 1));
  const prevTo = endOfMonth(subMonths(periodStart, 1));

  const fromIso = from.toISOString();
  const toExclusive = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, 0, 0).toISOString();
  const prevFromIso = prevFrom.toISOString();
  const prevToExclusive = new Date(
    prevTo.getFullYear(),
    prevTo.getMonth(),
    prevTo.getDate() + 1,
    0,
    0,
    0,
    0
  ).toISOString();

  const { data: eventsThis } = await supabase
    .from('banano_loyalty_events')
    .select('member_id, amount_cents, event_type, created_at, note, delta_points, delta_stamps')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusive);

  const { data: eventsPrev } = await supabase
    .from('banano_loyalty_events')
    .select('amount_cents, event_type')
    .eq('user_id', userId)
    .gte('created_at', prevFromIso)
    .lt('created_at', prevToExclusive);

  const { data: membersNew } = await supabase
    .from('banano_loyalty_members')
    .select('id, created_at')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusive);

  const newIds = new Set((membersNew ?? []).map((m) => m.id));

  let revenueCents = 0;
  let visitCount = 0;
  let hasRevenueData = false;
  let newMembersRevenueCents = 0;

  for (const e of eventsThis ?? []) {
    const amt = Math.max(0, Number((e as { amount_cents?: number }).amount_cents ?? 0));
    const et = String((e as { event_type?: string }).event_type ?? '');
    if (et === 'earn_points' || et === 'earn_stamps') {
      visitCount++;
    }
    if (amt > 0) {
      hasRevenueData = true;
      revenueCents += amt;
      const mid = (e as { member_id?: string }).member_id;
      if (mid && newIds.has(mid)) {
        newMembersRevenueCents += amt;
      }
    }
  }

  let prevRevenueCents = 0;
  for (const e of eventsPrev ?? []) {
    const amt = Math.max(0, Number((e as { amount_cents?: number }).amount_cents ?? 0));
    if (amt > 0) prevRevenueCents += amt;
  }

  const revenueChangePct =
    prevRevenueCents > 0
      ? Math.round(((revenueCents - prevRevenueCents) / prevRevenueCents) * 100 * 10) / 10
      : null;

  const { data: reviewsThis } = await supabase
    .from('reviews')
    .select('rating, source')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusive);

  const { data: reviewsPrev } = await supabase
    .from('reviews')
    .select('rating, source')
    .eq('user_id', userId)
    .gte('created_at', prevFromIso)
    .lt('created_at', prevToExclusive);

  const googleThis = (reviewsThis ?? []).filter((r) =>
    String((r as { source?: string }).source ?? '')
      .toLowerCase()
      .includes('google')
  ) as { rating?: number }[];
  const googlePrev = (reviewsPrev ?? []).filter((r) =>
    String((r as { source?: string }).source ?? '')
      .toLowerCase()
      .includes('google')
  ) as { rating?: number }[];

  const avg = (list: { rating?: number }[]) =>
    list.length ? list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length : 0;

  const googleAvgThis = avg(googleThis);
  const googleAvgPrev = avg(googlePrev);
  const googleRatingDelta =
    googleThis.length > 0 && googlePrev.length > 0 ? googleAvgThis - googleAvgPrev : null;

  let monthLabel: string;
  try {
    monthLabel = monthYearForLocale(from, appLocale);
  } catch {
    monthLabel = format(from, 'yyyy-MM');
  }

  let retentionFunnel: RetentionFunnelSnapshot = {
    newClientsThisMonth: 0,
    returnedAtLeastTwiceThisMonth: 0,
    vipProfilesCount: 0,
  };
  let weekdayHeat: WeekdayHeatCell[] = [];
  let retentionFunnelDetail: RetentionFunnelDetail = {
    newMembers: [],
    returnedTwice: [],
    vipProfiles: [],
  };
  let staffPerformance: BananoPerformanceMonthStats['staffPerformance'] = {
    rows: [],
  };

  try {
    const [{ data: membersAll }, staffPack] = await Promise.all([
      supabase
        .from('banano_loyalty_members')
        .select('id, display_name, first_name, last_name, lifetime_visit_count, last_visit_at, created_at')
        .eq('user_id', userId),
      fetchBananoStaffMonthStats(supabase, userId, periodStart).catch(() => null),
    ]);

    if (membersAll?.length) {
      const loyaltyEvents: LoyaltyEventRow[] = (eventsThis ?? []).map((e) => {
        const row = e as {
          created_at: string;
          event_type: string;
          member_id: string;
          amount_cents?: number | null;
          note?: string | null;
        };
        return {
          created_at: String(row.created_at ?? ''),
          event_type: String(row.event_type ?? ''),
          member_id: String(row.member_id ?? ''),
          amount_cents:
            row.amount_cents != null && Number.isFinite(Number(row.amount_cents))
              ? Math.floor(Number(row.amount_cents))
              : null,
          note: row.note != null ? String(row.note) : null,
        };
      });
      const memberRows = membersAll as MemberRow[];
      const asOf = endOfMonth(periodStart);
      const pilotageT = createServerTranslator('Dashboard.bananoPilotageCore', appLocale);
      const { funnel, heat, funnelDetail } = computeRetentionAndWeekdayHeat(
        asOf,
        loyaltyEvents,
        memberRows,
        fromIso,
        toExclusive,
        pilotageT('default_member_label')
      );
      retentionFunnel = funnel;
      weekdayHeat = heat;
      retentionFunnelDetail = funnelDetail;
    }

    if (staffPack && staffPack.rows.length > 0) {
      staffPerformance = {
        rows: staffPack.rows.map((r) => ({
          display_name: r.display_name,
          ticketsEncaisse: r.ticketsEncaisse,
          clientsCreated: r.clientsCreated,
          revenueCents: r.revenueCents,
          transformPercent: r.transformPercent,
          avgBasketCents: r.avgBasketCents,
          googlePositiveReviews: r.googlePositiveReviews,
        })),
      };
    } else if (staffPack) {
      staffPerformance = {
        rows: [],
      };
    }
  } catch {
    /* stats PDF : garder les valeurs par défaut */
  }

  const loyaltyEventsMonth: LoyaltyEventWithDeltas[] = (eventsThis ?? []).map((raw) => {
    const e = raw as Record<string, unknown>;
    return {
      created_at: String(e.created_at ?? ''),
      event_type: String(e.event_type ?? ''),
      delta_points:
        e.delta_points != null && Number.isFinite(Number(e.delta_points))
          ? Math.floor(Number(e.delta_points))
          : null,
      delta_stamps:
        e.delta_stamps != null && Number.isFinite(Number(e.delta_stamps))
          ? Math.floor(Number(e.delta_stamps))
          : null,
    };
  });
  const loyaltyMonth = sumLoyaltyKpisInRange(loyaltyEventsMonth, from, to);

  let whatsappRelances: BananoPerformanceMonthStats['whatsappRelances'] = {
    rulesEnabled: {
      lost_client: false,
      birthday: false,
      vip_of_month: false,
      new_client_welcome: false,
    },
    sendsMonth: { lost_client: 0, birthday: 0, vip_of_month: 0, new_client_welcome: 0 },
    attributedRevenueCents: 0,
    aggregateSendsMonth: 0,
  };
  try {
    const monthStartYmd = format(from, 'yyyy-MM-dd');
    const [relSnap, aggRes] = await Promise.all([
      fetchAutomationRelanceSnapshotForRange(supabase, userId, {
        fromIso,
        toExclusiveIso: toExclusive,
      }),
      supabase
        .from('banano_loyalty_automation_monthly_stats')
        .select('attributed_revenue_cents, sends_count')
        .eq('user_id', userId)
        .eq('month_start', monthStartYmd)
        .maybeSingle(),
    ]);
    if (aggRes.error) {
      console.warn('[performance-report-stats auto monthly]', aggRes.error.message);
    }
    const agg = aggRes.data as { attributed_revenue_cents?: number; sends_count?: number } | null;
    whatsappRelances = {
      rulesEnabled: relSnap.rulesEnabled,
      sendsMonth: relSnap.sendsMonth,
      attributedRevenueCents: Math.max(0, Math.floor(Number(agg?.attributed_revenue_cents ?? 0))),
      aggregateSendsMonth: Math.max(0, Math.floor(Number(agg?.sends_count ?? 0))),
    };
  } catch {
    /* PDF : garder les zéros */
  }

  let loyaltyValue: BananoPerformanceMonthStats['loyaltyValue'] = {
    costBreakdown: {
      redeemedByClass: [],
      totalFixedEuroRedeemedCents: 0,
      signupVouchersIssuedInMonth: 0,
      signupIssuedFixedEuroCents: 0,
      signupIssuedPercentCount: 0,
      signupIssuedLabelOnlyCount: 0,
      fixedRedemptionsByStaff: [],
    },
    revenueNetAfterFixedVoucherCents: revenueCents,
    revenueToFixedRedemptionRatio: null,
  };
  try {
    const costBreakdown = await fetchLoyaltyMonthCostBreakdown(supabase, userId, fromIso, toExclusive);
    const fixedRed = costBreakdown.totalFixedEuroRedeemedCents;
    const net = Math.max(0, revenueCents - fixedRed);
    const ratio =
      fixedRed > 0 && revenueCents > 0 ? Math.round((revenueCents / fixedRed) * 100) / 100 : null;
    loyaltyValue = {
      costBreakdown,
      revenueNetAfterFixedVoucherCents: net,
      revenueToFixedRedemptionRatio: ratio,
    };
  } catch {
    /* PDF : défauts */
  }

  let cashTerminalMonth: PilotageCashTerminalRow[] = [];
  let cashStaffMonth: PilotageCashStaffRow[] = [];
  try {
    const tUi = createServerTranslator('Dashboard.bananoOmnipresent', appLocale);
    const { data: cashIngestRows, error: cashIngestErr } = await supabase
      .from('banano_cash_ingestions')
      .select('amount, terminal_id, staff_name, matched_member_id')
      .eq('merchant_id', userId)
      .gte('ticket_at', fromIso)
      .lt('ticket_at', toExclusive);
    if (cashIngestErr) {
      console.warn('[performance-report-stats cash ingestions]', cashIngestErr.message);
    } else {
      const agg = aggregateCashIngestionRows(cashIngestRows ?? [], {
        unknownTerminal: tUi('cashTerminalUnknown'),
        unnamedStaff: tUi('cashStaffUnnamed'),
      });
      cashTerminalMonth = agg.terminals;
      cashStaffMonth = agg.staff;
    }
  } catch {
    /* PDF : garder tableaux vides */
  }

  return {
    monthStartIso: format(from, 'yyyy-MM-dd'),
    monthLabel,
    revenueCents,
    prevRevenueCents,
    revenueChangePct: revenueChangePct != null ? Math.round(revenueChangePct * 10) / 10 : null,
    newMembersCount: newIds.size,
    newMembersRevenueCents,
    visitCount,
    googleAvgThis,
    googleAvgPrev,
    googleRatingDelta: googleRatingDelta != null ? Math.round(googleRatingDelta * 100) / 100 : null,
    googleReviewCountThis: googleThis.length,
    hasRevenueData,
    retentionFunnel,
    staffPerformance,
    loyaltyMonth,
    whatsappRelances,
    loyaltyValue,
    weekdayHeat,
    retentionFunnelDetail,
    cashTerminalMonth,
    cashStaffMonth,
  };
}
