import { NextResponse } from 'next/server';
import { endOfMonth, format, parseISO, startOfMonth, subDays } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import { mergeLostConfig } from '@/lib/banano/banano-automation-defaults';
import {
  buildPilotageDashboard,
  type LoyaltyEventRow,
  type MemberRow,
} from '@/lib/banano/pilotage/build-pilotage-dashboard';
import { buildMonthlyFinancialCoach } from '@/lib/banano/pilotage/monthly-goal-coach';
import { computeRetentionAndWeekdayHeat } from '@/lib/banano/pilotage/retention-weekday';
import {
  computeLoyaltyProgramKpis,
  type LoyaltyEventWithDeltas,
} from '@/lib/banano/pilotage/loyalty-program-kpis';
import {
  buildCalendarMonthCells,
  buildPilotageFeedWallItems,
  computeCashDeskMetrics,
  monthWindowInTimeZone,
  todayWindowInTimeZone,
} from '@/lib/banano/pilotage/operational-metrics';
import { computeAtRiskMembers } from '@/lib/banano/pilotage/at-risk-members';
import { fetchAutomationRelanceSnapshotForRange } from '@/lib/banano/pilotage/automation-relance-snapshot';
import type {
  PilotageDashboardPayload,
  PilotageLoyaltyProfitabilityMonth,
  PilotageReportListItem,
} from '@/lib/banano/pilotage/types';
import { resolveMerchantTimeZone } from '@/lib/datetime/merchant-timezone';
import { fetchLoyaltyMonthCostBreakdown } from '@/lib/banano/pilotage/loyalty-month-costs';
import {
  aggregateCashIngestionRows,
  type PilotageCashStaffRow,
  type PilotageCashTerminalRow,
} from '@/lib/banano/pilotage/cash-ingest-aggregates';

export async function GET(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tUi = createServerTranslator('Dashboard.bananoOmnipresent', locale);
  const dfLoc = dateFnsLocaleForApp(locale);
  const url = new URL(req.url);
  const calY = parseInt(url.searchParams.get('calendarYear') ?? '', 10);
  const calM = parseInt(url.searchParams.get('calendarMonth') ?? '', 10);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  /** Journaux fidélité = `banano_loyalty_events` (alias métier possible : loyalty_logs). */
  const profileSelect =
    'establishment_name, banano_pilotage_daily_revenue_goal_cents, banano_pilotage_daily_visit_goal, banano_pilotage_monthly_revenue_goal_cents, timezone';

  let profile: Record<string, unknown> | null = null;
  const profileRes = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();

  if (profileRes.error) {
    const pe = profileRes.error;
    const msg = pe.message ?? '';
    const code = 'code' in pe ? String((pe as { code?: string }).code ?? '') : '';
    const missingColumn =
      code === '42703' || /does not exist/i.test(msg) || /Could not find the ['"][^'"]+['"] column/i.test(msg);

    if (missingColumn) {
      console.warn('[banano/pilotage profile] pilotage profile columns missing, using defaults', msg);
      const fb = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (fb.error) {
        console.error('[banano/pilotage profile]', fb.error.message);
        return NextResponse.json({ error: tm('bootstrapProfileReadFailed') }, { status: 500 });
      }
      profile = {};
    } else {
      console.error('[banano/pilotage profile]', msg);
      return NextResponse.json({ error: tm('bootstrapProfileReadFailed') }, { status: 500 });
    }
  } else {
    profile = (profileRes.data as Record<string, unknown> | null) ?? null;
  }

  const row = profile;
  const merchantEstablishmentName = String(row?.establishment_name ?? '').trim();
  const rawRevGoal = row?.banano_pilotage_daily_revenue_goal_cents;
  const dailyRevenueGoalCents =
    rawRevGoal != null && Number(rawRevGoal) > 0 ? Math.floor(Number(rawRevGoal)) : null;
  const rawVisitGoal = row?.banano_pilotage_daily_visit_goal;
  const dailyVisitGoal =
    rawVisitGoal != null && Number(rawVisitGoal) >= 1
      ? Math.min(100_000, Math.floor(Number(rawVisitGoal)))
      : null;

  const rawMonthlyGoal = row?.banano_pilotage_monthly_revenue_goal_cents;
  const monthlyRevenueGoalCents =
    rawMonthlyGoal != null && Number(rawMonthlyGoal) > 0
      ? Math.floor(Number(rawMonthlyGoal))
      : null;

  const { data: ruleRow, error: ruleErr } = await supabase
    .from('banano_loyalty_automation_rules')
    .select('config')
    .eq('user_id', user.id)
    .eq('rule_type', 'lost_client')
    .maybeSingle();

  if (ruleErr) {
    console.warn('[banano/pilotage rules]', ruleErr.message);
  }

  const lostCfg = mergeLostConfig(
    (ruleRow as { config?: Record<string, unknown> } | null)?.config ?? {}
  );
  const inactiveDays = lostCfg.inactive_days;
  const minLifetimeVisits = lostCfg.min_lifetime_visits;

  const fromIso = subDays(new Date(), 70).toISOString();

  const { data: eventsRaw, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select(
      'created_at, event_type, member_id, amount_cents, note, items_count, delta_points, delta_stamps, staff_id'
    )
    .eq('user_id', user.id)
    .gte('created_at', String(fromIso))
    .order('created_at', { ascending: true })
    .limit(12_000);

  if (evErr) {
    console.error('[banano/pilotage events]', evErr.message);
    return NextResponse.json({ error: tm('pilotageEventsReadFailed') }, { status: 500 });
  }

  const { data: membersRaw, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select(
      'id, display_name, first_name, last_name, lifetime_visit_count, last_visit_at, created_at, phone_e164'
    )
    .eq('user_id', user.id);

  if (memErr) {
    console.error('[banano/pilotage members]', memErr.message);
    return NextResponse.json({ error: tm('pilotageMembersReadFailed') }, { status: 500 });
  }

  const events = (eventsRaw ?? []) as LoyaltyEventRow[];
  const members = (membersRaw ?? []) as MemberRow[];

  const loyaltyEventsForKpis: LoyaltyEventWithDeltas[] = (eventsRaw ?? []).map((raw) => {
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

  const now = new Date();
  const merchantTz = resolveMerchantTimeZone(
    String((row as { timezone?: string } | null)?.timezone ?? '').trim() || null
  );
  const calRef =
    Number.isFinite(calY) && Number.isFinite(calM) && calM >= 1 && calM <= 12 && calY >= 2020 && calY <= 2100
      ? new Date(Date.UTC(calY, calM - 1, 1, 12, 0, 0, 0))
      : now;
  const pilotageT = createServerTranslator('Dashboard.bananoPilotageCore', locale);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const monthEndExclusive = new Date(
    monthEnd.getFullYear(),
    monthEnd.getMonth(),
    monthEnd.getDate() + 1,
    0,
    0,
    0,
    0
  ).toISOString();
  const monthStartIso = monthStart.toISOString();

  let revenueMonthCents = 0;
  for (const e of eventsRaw ?? []) {
    const rowE = e as { created_at?: string; amount_cents?: number | null };
    const t = String(rowE.created_at ?? '');
    if (t >= monthStartIso && t < monthEndExclusive) {
      revenueMonthCents += Math.max(0, Math.floor(Number(rowE.amount_cents ?? 0)));
    }
  }

  let totalCashIngestedMonthCents = 0;
  let cash_terminal_month: PilotageCashTerminalRow[] = [];
  let cash_staff_month: PilotageCashStaffRow[] = [];

  const { data: cashIngestRows, error: cashIngestErr } = await supabase
    .from('banano_cash_ingestions')
    .select('amount, terminal_id, staff_name, matched_member_id')
    .eq('merchant_id', user.id)
    .gte('ticket_at', monthStartIso)
    .lt('ticket_at', monthEndExclusive);

  if (cashIngestErr) {
    console.warn('[banano/pilotage cash ingestions]', cashIngestErr.message);
  } else {
    const agg = aggregateCashIngestionRows(cashIngestRows ?? [], {
      unknownTerminal: tUi('cashTerminalUnknown'),
      unnamedStaff: tUi('cashStaffUnnamed'),
    });
    cash_terminal_month = agg.terminals;
    cash_staff_month = agg.staff;
    totalCashIngestedMonthCents = agg.terminals.reduce((s, x) => s + x.revenueCents, 0);
  }

  let loyaltyProfitabilityMonth: PilotageLoyaltyProfitabilityMonth | null = null;
  try {
    const [costPack, newMembersRes] = await Promise.all([
      fetchLoyaltyMonthCostBreakdown(supabase, user.id, monthStartIso, monthEndExclusive),
      supabase
        .from('banano_loyalty_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStartIso)
        .lt('created_at', monthEndExclusive),
    ]);
    const fixedRed = costPack.totalFixedEuroRedeemedCents;
    const ratio =
      fixedRed > 0 && revenueMonthCents > 0
        ? Math.round((revenueMonthCents / fixedRed) * 100) / 100
        : null;
    loyaltyProfitabilityMonth = {
      revenueGrossCents: revenueMonthCents,
      fixedVoucherRedemptionCents: fixedRed,
      revenueNetCents: Math.max(0, revenueMonthCents - fixedRed),
      newMembersCount: newMembersRes.count ?? 0,
      signupVouchersIssued: costPack.signupVouchersIssuedInMonth,
      signupIssuedFixedEuroCents: costPack.signupIssuedFixedEuroCents,
      revenueToFixedRedemptionRatio: ratio,
    };
  } catch (e) {
    console.warn('[banano/pilotage loyalty profitability]', e);
  }

  const monthlyFinancial =
    monthlyRevenueGoalCents != null && monthlyRevenueGoalCents > 0
      ? (() => {
          const c = buildMonthlyFinancialCoach(now, monthlyRevenueGoalCents, revenueMonthCents, {
            locale,
            pilotageT: (key, values) =>
              pilotageT(key, values as Record<string, string | number | boolean | Date> | undefined),
          });
          return {
            goalCents: c.goalCents,
            revenueCents: c.revenueCents,
            progressPercent: c.progressPercent,
            daysLeft: c.daysLeft,
            coachLine: c.coachLine,
            warCouncilLine: c.warCouncilLine,
            forecastLine: c.forecastLine,
          };
        })()
      : null;

  const { funnel, heat, funnelDetail } = computeRetentionAndWeekdayHeat(
    now,
    events,
    members,
    monthStartIso,
    monthEndExclusive,
    pilotageT('default_member_label')
  );

  const repRes = await supabase
    .from('banano_pilotage_performance_reports')
    .select('month_start, ai_badge, ai_headline, created_at')
    .eq('user_id', user.id)
    .order('month_start', { ascending: false })
    .limit(36);

  if (repRes.error) {
    console.warn('[banano/pilotage reports]', repRes.error.message);
  }

  const reportRows =
    (repRes.data as {
      month_start: string;
      ai_badge: string;
      ai_headline: string;
      created_at: string;
    }[]) ?? [];

  const reports: PilotageReportListItem[] = reportRows.map((r) => {
    const d = parseISO(String(r.month_start));
    const lf = format(d, 'MMMM yyyy', { locale: dfLoc });
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      labelFr: lf.charAt(0).toUpperCase() + lf.slice(1),
      aiBadge: String(r.ai_badge ?? ''),
      aiHeadline: String(r.ai_headline ?? ''),
      createdAt: String(r.created_at ?? ''),
    };
  });

  const payload = buildPilotageDashboard({
    now,
    events,
    members,
    dailyRevenueGoalCents:
      dailyRevenueGoalCents != null && dailyRevenueGoalCents > 0
        ? dailyRevenueGoalCents
        : null,
    dailyVisitGoal: dailyVisitGoal != null && dailyVisitGoal > 0 ? dailyVisitGoal : null,
    inactiveDays,
    minLifetimeVisits,
    extras: undefined,
    siteLocale: locale,
    pilotageT: (key, values) =>
      pilotageT(key, values as Record<string, string | number | boolean | Date> | undefined),
  });

  const loyaltyProgramKpis = computeLoyaltyProgramKpis(loyaltyEventsForKpis, now);

  const metricsWindow = monthWindowInTimeZone(calRef, merchantTz);
  const cashDeskMetrics = computeCashDeskMetrics(
    events,
    members,
    metricsWindow.fromIso,
    metricsWindow.toExclusiveIso
  );
  const calendarMonth = buildCalendarMonthCells(events, calRef, merchantTz, locale);

  const tw = todayWindowInTimeZone(now, merchantTz);
  const [birthdayCountRes, autoStatsRes, feedEvRes] = await Promise.all([
    supabase
      .from('banano_loyalty_automation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('rule_type', 'birthday')
      .eq('status', 'sent')
      .gte('created_at', tw.fromIso)
      .lt('created_at', tw.toExclusiveIso),
    supabase
      .from('banano_loyalty_automation_monthly_stats')
      .select('attributed_revenue_cents, sends_count')
      .eq('user_id', user.id)
      .eq('month_start', format(monthStart, 'yyyy-MM-dd'))
      .maybeSingle(),
    supabase
      .from('banano_loyalty_events')
      .select('id, created_at, event_type, member_id, amount_cents, delta_points, delta_stamps')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(28),
  ]);

  if (birthdayCountRes.error) {
    console.warn('[banano/pilotage birthday count]', birthdayCountRes.error.message);
  }
  if (autoStatsRes.error) {
    console.warn('[banano/pilotage auto stats]', autoStatsRes.error.message);
  }
  if (feedEvRes.error) {
    console.warn('[banano/pilotage feed]', feedEvRes.error.message);
  }

  const autoStats = autoStatsRes.data as
    | { attributed_revenue_cents?: number; sends_count?: number }
    | null
    | undefined;
  const relanceSnap = await fetchAutomationRelanceSnapshotForRange(supabase, user.id, {
    fromIso: monthStartIso,
    toExclusiveIso: monthEndExclusive,
  });
  const automationStatus = {
    birthdayMessagesSentToday: birthdayCountRes.count ?? 0,
    pushAttributedRevenueMonthCents: Math.max(
      0,
      Math.floor(Number(autoStats?.attributed_revenue_cents ?? 0))
    ),
    pushSendsCountMonth: Math.max(0, Math.floor(Number(autoStats?.sends_count ?? 0))),
    automationStatsMonthStart: format(monthStart, 'yyyy-MM-dd'),
    relanceRulesEnabled: relanceSnap.rulesEnabled,
    relanceSendsMonth: relanceSnap.sendsMonth,
  };

  const rawFeed = (feedEvRes.data ?? []) as Array<{
    id: string;
    created_at: string;
    event_type: string;
    member_id: string;
    amount_cents?: number | null;
    delta_points?: number | null;
    delta_stamps?: number | null;
  }>;
  const feedMemberIds = [...new Set(rawFeed.map((e) => e.member_id))];
  const feedMemberMap = new Map<
    string,
    { display_name: string | null; first_name: string | null; last_name: string | null }
  >();
  if (feedMemberIds.length > 0) {
    const { data: fm } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', feedMemberIds);
    for (const m of fm ?? []) {
      const r = m as {
        id: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      };
      feedMemberMap.set(r.id, {
        display_name: r.display_name,
        first_name: r.first_name,
        last_name: r.last_name,
      });
    }
  }

  const feedWall = buildPilotageFeedWallItems(
    rawFeed,
    feedMemberMap,
    (key: string, values?: Record<string, string | number | boolean | Date>) =>
      tUi(key, values as Record<string, string | number | boolean | Date> | undefined),
    locale
  );

  const atRiskMembers = computeAtRiskMembers(
    now,
    merchantTz,
    members,
    pilotageT('default_member_label')
  );

  const full: PilotageDashboardPayload = {
    ...payload,
    monthlyFinancial,
    loyaltyProfitabilityMonth,
    reports,
    retentionFunnel: funnel,
    retentionFunnelDetail: funnelDetail,
    weekdayHeat: heat,
    loyaltyProgramKpis,
    merchantTimeZone: merchantTz,
    cashDeskMetrics,
    calendarMonth,
    automationStatus,
    feedWall,
    atRiskMembers,
    merchantEstablishmentName,
    viewerUserId: user.id,
    total_cash_ingested_month: totalCashIngestedMonthCents,
    cash_terminal_month,
    cash_staff_month,
  };

  return NextResponse.json(full);
}
