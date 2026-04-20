import {
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import type {
  OmnipresentKpiBlock,
  PilotageCorePayload,
  PilotageDailyActivityRow,
  PilotageWeekSummaryRow,
  SmartCardItem,
  TemporalViewKey,
  VipSmartCardContact,
} from './types';
import { PILOTAGE_DAILY_ACTIVITY_DAYS } from './types';
import { siteLocaleToDateFnsLocale } from './date-locale';

const VISIT_EVENTS = new Set(['earn_points', 'earn_stamps']);

export type PilotageTranslate = (key: string, values?: Record<string, unknown>) => string;

export type LoyaltyEventRow = {
  created_at: string;
  event_type: string;
  member_id: string;
  amount_cents: number | null;
  note: string | null;
  /** Optionnel : nb d’articles / lignes ticket (caisse). */
  items_count?: number | null;
  /** Optionnel : équipier terminal (stats pilotage). */
  staff_id?: string | null;
};

export type MemberRow = {
  id: string;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  lifetime_visit_count: number | null;
  last_visit_at: string | null;
  created_at?: string | null;
  phone_e164?: string | null;
};

export type BuildPilotageInput = {
  now: Date;
  events: LoyaltyEventRow[];
  members: MemberRow[];
  dailyRevenueGoalCents: number | null;
  dailyVisitGoal: number | null;
  inactiveDays: number;
  minLifetimeVisits: number;
  /** POS / ERP futur : best-seller, stock. */
  extras?: {
    topProduct?: { name: string; marginSharePct: number };
    stock?: { label: string; ratioVsForecast: number };
  };
  /** Locale d’affichage (libellés date dans dailyActivity, etc.). */
  siteLocale?: string;
  /** Messages `Dashboard.bananoPilotageCore` (next-intl). */
  pilotageT: PilotageTranslate;
};

function formatEurLocale(cents: number, locale: string): string {
  const nonZeroDec = cents % 100 !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: nonZeroDec ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function monthInProgressPeriodLabel(
  ref: Date,
  siteLocale: string,
  pilotageT: PilotageTranslate
): string {
  const ms = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = endOfMonth(ms);
  const loc = siteLocaleToDateFnsLocale(siteLocale);
  return pilotageT('vip_month_range', {
    from: format(ms, 'd MMMM yyyy', { locale: loc }),
    to: format(last, 'd MMMM yyyy', { locale: loc }),
  });
}

function pctFmtSignedLocale(n: number, locale: string): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
}

function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function displayMemberName(m: MemberRow, defaultLabel: string): string {
  const f = (m.first_name ?? '').trim();
  const l = (m.last_name ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  const d = (m.display_name ?? '').trim();
  return d || defaultLabel;
}

function vipContactFrom(
  memberId: string,
  m: MemberRow,
  spendCents: number,
  visitsInPeriod: number,
  basis: 'spend' | 'visits',
  defaultLabel: string
): VipSmartCardContact {
  return {
    memberId,
    phoneE164: m.phone_e164 ?? null,
    firstName: m.first_name ?? null,
    lastName: m.last_name ?? null,
    displayName: displayMemberName(m, defaultLabel),
    spendCents,
    visitsInPeriod,
    basis,
  };
}

function dayKeyParisFromIso(iso: string): string {
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function topNotesForDayRows(rows: LoyaltyEventRow[]): { text: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of rows) {
    const n = (e.note ?? '').trim();
    if (n.length < 2) continue;
    const key = n.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return sorted.map(([key, count]) => {
    const original = rows.find(
      (e) => VISIT_EVENTS.has(e.event_type) && (e.note ?? '').trim().toLowerCase() === key
    );
    return { text: original?.note?.trim() ?? key, count };
  });
}

function aggregateDayRow(
  dateKey: string,
  dayEv: LoyaltyEventRow[],
  siteLocale = 'fr'
): PilotageDailyActivityRow {
  const d = parseISO(`${dateKey}T12:00:00`);
  let visitCount = 0;
  let revenueCents = 0;
  let ticketsWithAmount = 0;
  let itemsSum = 0;
  let itemsKnownRows = 0;
  for (const ev of dayEv) {
    if (!VISIT_EVENTS.has(ev.event_type)) continue;
    visitCount++;
    const ac = Math.max(0, Math.floor(Number(ev.amount_cents ?? 0)));
    if (ac > 0) {
      revenueCents += ac;
      ticketsWithAmount++;
    }
    const ic = ev.items_count;
    if (ic != null && Number.isFinite(Number(ic)) && Number(ic) > 0) {
      itemsSum += Math.floor(Number(ic));
      itemsKnownRows++;
    }
  }
  const avgBasketCents =
    ticketsWithAmount > 0 ? Math.round(revenueCents / ticketsWithAmount) : null;
  const loc = siteLocaleToDateFnsLocale(siteLocale);
  const labelRaw = format(d, 'EEE d MMM', { locale: loc });
  return {
    dateKey,
    labelFr: labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1),
    visitCount,
    revenueCents,
    ticketsWithAmount,
    avgBasketCents,
    itemsSold: itemsKnownRows > 0 ? itemsSum : null,
    topLabels: topNotesForDayRows(dayEv.filter((e) => VISIT_EVENTS.has(e.event_type))),
  };
}

export function buildDailyActivityRows(
  now: Date,
  visitRows: LoyaltyEventRow[],
  siteLocale = 'fr'
): PilotageDailyActivityRow[] {
  const end = startOfDay(now);
  const keysOrdered: string[] = [];
  const byDay = new Map<string, LoyaltyEventRow[]>();
  for (let i = PILOTAGE_DAILY_ACTIVITY_DAYS - 1; i >= 0; i--) {
    const d = subDays(end, i);
    const k = format(d, 'yyyy-MM-dd');
    keysOrdered.push(k);
    byDay.set(k, []);
  }
  for (const e of visitRows) {
    const k = dayKeyParisFromIso(e.created_at);
    if (!byDay.has(k)) continue;
    byDay.get(k)!.push(e);
  }
  const chronological: PilotageDailyActivityRow[] = [];
  for (const dateKey of keysOrdered) {
    const dayEv = byDay.get(dateKey) ?? [];
    chronological.push(aggregateDayRow(dateKey, dayEv, siteLocale));
  }
  return chronological.slice().reverse();
}

export function buildDailyActivityRowsForDateRange(
  visitRows: LoyaltyEventRow[],
  rangeStart: Date,
  rangeEnd: Date,
  siteLocale = 'fr'
): PilotageDailyActivityRow[] {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  if (start > end) return [];
  const days = eachDayOfInterval({ start, end });
  const byDay = new Map<string, LoyaltyEventRow[]>();
  for (const d of days) {
    byDay.set(format(d, 'yyyy-MM-dd'), []);
  }
  for (const e of visitRows) {
    const k = dayKeyParisFromIso(e.created_at);
    if (!byDay.has(k)) continue;
    byDay.get(k)!.push(e);
  }
  const chronological: PilotageDailyActivityRow[] = [];
  for (const d of days) {
    const dateKey = format(d, 'yyyy-MM-dd');
    chronological.push(aggregateDayRow(dateKey, byDay.get(dateKey) ?? [], siteLocale));
  }
  return chronological.slice().reverse();
}

export function buildWeeklySummaryForRange(
  visitRows: LoyaltyEventRow[],
  rangeStart: Date,
  rangeEnd: Date,
  siteLocale = 'fr'
): PilotageWeekSummaryRow[] {
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  if (rs > re) return [];
  let wStart = startOfWeek(rs, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(re, { weekStartsOn: 1 });
  const out: PilotageWeekSummaryRow[] = [];
  while (wStart <= lastWeekStart) {
    const wEndSunday = endOfWeek(wStart, { weekStartsOn: 1 });
    const sliceStart = wStart < rs ? rs : wStart;
    const sliceEnd = wEndSunday > re ? re : wEndSunday;
    const visits: LoyaltyEventRow[] = [];
    for (const e of visitRows) {
      if (!VISIT_EVENTS.has(e.event_type)) continue;
      const t = startOfDay(parseISO(e.created_at));
      if (t >= sliceStart && t <= sliceEnd) visits.push(e);
    }
    const visitCount = visits.length;
    let revenueCents = 0;
    let ticketsWithAmount = 0;
    let itemsSum = 0;
    let itemsKnownRows = 0;
    for (const ev of visits) {
      const ac = Math.max(0, Math.floor(Number(ev.amount_cents ?? 0)));
      if (ac > 0) {
        revenueCents += ac;
        ticketsWithAmount++;
      }
      const ic = ev.items_count;
      if (ic != null && Number.isFinite(Number(ic)) && Number(ic) > 0) {
        itemsSum += Math.floor(Number(ic));
        itemsKnownRows++;
      }
    }
    const avgBasketCents =
      ticketsWithAmount > 0 ? Math.round(revenueCents / ticketsWithAmount) : null;
    const wk = format(wStart, 'yyyy-MM-dd');
    const loc = siteLocaleToDateFnsLocale(siteLocale);
    const labelFrRaw = `${format(wStart, 'd MMM', { locale: loc })} – ${format(wEndSunday, 'd MMM yyyy', { locale: loc })}`;
    out.push({
      weekKey: wk,
      labelFr: labelFrRaw.charAt(0).toUpperCase() + labelFrRaw.slice(1),
      visitCount,
      revenueCents,
      ticketsWithAmount,
      avgBasketCents,
      itemsSold: itemsKnownRows > 0 ? itemsSum : null,
      topLabels: topNotesForDayRows(visits),
    });
    wStart = addWeeks(wStart, 1);
  }
  return out.slice().reverse();
}

function topNoteFromEvents(rows: LoyaltyEventRow[]): { text: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of rows) {
    if (!VISIT_EVENTS.has(e.event_type)) continue;
    const n = (e.note ?? '').trim();
    if (n.length < 2) continue;
    const key = n.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestC = 0;
  for (const [k, c] of counts) {
    if (c > bestC) {
      bestC = c;
      best = k;
    }
  }
  if (!best || bestC < 2) return null;
  const original = rows.find(
    (e) => VISIT_EVENTS.has(e.event_type) && e.note && e.note.trim().toLowerCase() === best
  );
  const text = original?.note?.trim() ?? best;
  return { text, count: bestC };
}

export function buildPilotageDashboard(input: BuildPilotageInput): PilotageCorePayload {
  const {
    now,
    events,
    members,
    dailyRevenueGoalCents,
    dailyVisitGoal,
    inactiveDays,
    minLifetimeVisits,
    extras,
    siteLocale = 'fr',
    pilotageT,
  } = input;

  const loc = siteLocale;
  const fmt = (cents: number) => formatEurLocale(cents, loc);
  const defLabel = pilotageT('default_member_label');

  const visitRows = events.filter((e) => VISIT_EVENTS.has(e.event_type));
  const hasTicketAmounts = visitRows.some((e) => (e.amount_cents ?? 0) > 0);
  const dailyActivity = buildDailyActivityRows(now, visitRows, siteLocale);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const visitsToday = visitRows.filter((e) =>
    isWithinInterval(parseISO(e.created_at), { start: dayStart, end: dayEnd })
  );
  const revenueTodayCents = visitsToday.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  const useRevenueDay =
    revenueTodayCents > 0 ||
    (dailyRevenueGoalCents != null && dailyRevenueGoalCents > 0);

  let dayBlock: OmnipresentKpiBlock;

  if (useRevenueDay) {
    const headline = fmt(revenueTodayCents);
    let subline: string;
    let progressPercent: number | null = null;
    if (dailyRevenueGoalCents != null && dailyRevenueGoalCents > 0) {
      progressPercent = Math.min(100, Math.round((revenueTodayCents / dailyRevenueGoalCents) * 100));
      subline = pilotageT('day_subline_revenue_goal', {
        goal: fmt(dailyRevenueGoalCents),
        pct: progressPercent,
      });
    } else {
      subline = pilotageT('day_subline_revenue_no_goal');
    }
    let insight: string;
    if (visitsToday.length < 2) {
      insight = pilotageT('day_insight_revenue_few');
    } else {
      const byHour = new Map<number, number>();
      for (const e of visitsToday) {
        const h = parseISO(e.created_at).getHours();
        byHour.set(h, (byHour.get(h) ?? 0) + 1);
      }
      let bestH = 0;
      let bestC = 0;
      for (const [h, c] of byHour) {
        if (c > bestC) {
          bestC = c;
          bestH = h;
        }
      }
      const share = Math.round((bestC / visitsToday.length) * 100);
      insight = pilotageT('day_insight_revenue_golden_hour', {
        share,
        hourStart: bestH,
        hourEnd: bestH + 1,
      });
    }
    dayBlock = { headline, subline, insight, progressPercent };
  } else {
    const n = visitsToday.length;
    const headline = pilotageT('day_headline_visits', { n });
    let subline: string;
    let progressPercent: number | null = null;
    if (dailyVisitGoal != null && dailyVisitGoal > 0) {
      progressPercent = Math.min(100, Math.round((n / dailyVisitGoal) * 100));
      subline = pilotageT('day_subline_visit_goal', {
        goal: dailyVisitGoal,
        pct: progressPercent,
      });
    } else {
      subline = pilotageT('day_subline_visit_no_goal');
    }
    let insight: string;
    if (n < 3) {
      insight = pilotageT('day_insight_visit_few');
    } else {
      const byHour = new Map<number, number>();
      for (const e of visitsToday) {
        const h = parseISO(e.created_at).getHours();
        byHour.set(h, (byHour.get(h) ?? 0) + 1);
      }
      let bestH = 0;
      let bestC = 0;
      for (const [h, c] of byHour) {
        if (c > bestC) {
          bestC = c;
          bestH = h;
        }
      }
      const share = Math.round((bestC / n) * 100);
      insight = pilotageT('day_insight_visit_peak', {
        share,
        hourStart: bestH,
        hourEnd: bestH + 1,
      });
    }
    dayBlock = { headline, subline, insight, progressPercent };
  }

  const w0 = startOfWeek(now, { weekStartsOn: 1 });
  const w1 = endOfWeek(now, { weekStartsOn: 1 });
  const wPrevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const wPrevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const thisWeekVisits = visitRows.filter((e) =>
    isWithinInterval(parseISO(e.created_at), { start: w0, end: w1 })
  );
  const lastWeekVisits = visitRows.filter((e) =>
    isWithinInterval(parseISO(e.created_at), { start: wPrevStart, end: wPrevEnd })
  );

  let weekHeadline: string;
  if (thisWeekVisits.length === 0 && lastWeekVisits.length === 0) {
    weekHeadline = '—';
  } else if (lastWeekVisits.length === 0) {
    weekHeadline = thisWeekVisits.length > 0 ? pilotageT('week_headline_strong') : '—';
  } else {
    const chg = ((thisWeekVisits.length - lastWeekVisits.length) / lastWeekVisits.length) * 100;
    weekHeadline = pctFmtSignedLocale(chg, loc);
  }

  const weekSub = pilotageT('week_sub');

  let weekInsight: string;
  if (thisWeekVisits.length < 4) {
    weekInsight = pilotageT('week_insight_low_data');
  } else {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const e of thisWeekVisits) {
      counts[mondayIndex(parseISO(e.created_at))]++;
    }
    const sum = counts.reduce((a, b) => a + b, 0);
    const mean = sum / 7;
    let weakIdx = 0;
    let weakMin = Infinity;
    for (let i = 0; i < 7; i++) {
      if (counts[i] < weakMin) {
        weakMin = counts[i];
        weakIdx = i;
      }
    }
    const locFns = siteLocaleToDateFnsLocale(loc);
    const weekdayRaw = format(new Date(2024, 0, 1 + weakIdx), 'EEEE', { locale: locFns });
    const vsAvg = mean > 0 ? ((weakMin - mean) / mean) * 100 : 0;
    weekInsight = pilotageT('week_insight_calm_day', {
      weekday: weekdayRaw,
      pctVsAvg: pctFmtSignedLocale(vsAvg, loc),
    });
  }

  if (visitRows.length >= 8) {
    const satN = visitRows.filter((e) => parseISO(e.created_at).getDay() === 6).length;
    const share = Math.round((satN / visitRows.length) * 100);
    weekInsight += pilotageT('week_insight_saturday_append', { share });
  }

  const weekBlock: OmnipresentKpiBlock = {
    headline: weekHeadline,
    subline: weekSub,
    insight: weekInsight,
    progressPercent: null,
  };

  const m0 = startOfMonth(now);
  const m1 = endOfMonth(now);
  const monthVisits = visitRows.filter((e) =>
    isWithinInterval(parseISO(e.created_at), { start: m0, end: m1 })
  );
  const revenueMonthCents = monthVisits.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const monthWithAmount = monthVisits.filter((e) => (e.amount_cents ?? 0) > 0);
  const avgBasketCents =
    monthWithAmount.length > 0
      ? Math.round(revenueMonthCents / monthWithAmount.length)
      : 0;

  let monthHeadline: string;
  let monthSub: string;
  let monthInsight: string;

  if (monthWithAmount.length >= 3) {
    monthHeadline = fmt(avgBasketCents);
    monthSub = pilotageT('month_subline_avg_basket', { count: monthWithAmount.length });
    const byMemberAmount = new Map<string, number>();
    const ticketWithAmountByMember = new Map<string, number>();
    for (const e of monthWithAmount) {
      ticketWithAmountByMember.set(
        e.member_id,
        (ticketWithAmountByMember.get(e.member_id) ?? 0) + 1
      );
      byMemberAmount.set(
        e.member_id,
        (byMemberAmount.get(e.member_id) ?? 0) + (e.amount_cents ?? 0)
      );
    }
    let sumLoyal = 0;
    let nLoyal = 0;
    let sumCasual = 0;
    let nCasual = 0;
    for (const [mid, total] of byMemberAmount) {
      const m = memberById.get(mid);
      const loyal = (m?.lifetime_visit_count ?? 0) >= 3;
      const nTickets = ticketWithAmountByMember.get(mid) ?? 1;
      const avg = total / nTickets;
      if (loyal) {
        sumLoyal += avg;
        nLoyal++;
      } else {
        sumCasual += avg;
        nCasual++;
      }
    }
    if (nLoyal >= 2 && nCasual >= 2) {
      const al = sumLoyal / nLoyal;
      const ac = sumCasual / nCasual;
      const uplift = ac > 0 ? ((al - ac) / ac) * 100 : 0;
      monthInsight = pilotageT('month_insight_loyalty_uplift', {
        pct: pctFmtSignedLocale(uplift, loc),
      });
    } else {
      monthInsight = pilotageT('month_insight_increase_variety');
    }
  } else if (monthVisits.length >= 5) {
    const byMember = new Map<string, number>();
    for (const e of monthVisits) {
      byMember.set(e.member_id, (byMember.get(e.member_id) ?? 0) + 1);
    }
    let sL = 0;
    let cL = 0;
    let sC = 0;
    let cC = 0;
    for (const [mid, vc] of byMember) {
      const m = memberById.get(mid);
      const loyal = (m?.lifetime_visit_count ?? 0) >= 3;
      if (loyal) {
        sL += vc;
        cL++;
      } else {
        sC += vc;
        cC++;
      }
    }
    const avgL = cL > 0 ? sL / cL : 0;
    const avgC = cC > 0 ? sC / cC : 0;
    const diff = avgC > 0 ? ((avgL - avgC) / avgC) * 100 : 0;
    monthHeadline = pilotageT('month_headline_passages_count', { n: monthVisits.length });
    monthSub = pilotageT('month_subline_volume_no_amount');
    monthInsight =
      cL >= 1 && cC >= 1
        ? pilotageT('month_insight_frequency_compare', {
            pct: pctFmtSignedLocale(diff, loc),
          })
        : pilotageT('month_insight_enter_amounts_hint');
  } else {
    monthHeadline =
      monthVisits.length > 0
        ? pilotageT('month_headline_passages_count', { n: monthVisits.length })
        : '—';
    monthSub = pilotageT('month_subline_sparse_data');
    monthInsight = pilotageT('month_insight_sparse');
  }

  const monthBlock: OmnipresentKpiBlock = {
    headline: monthHeadline,
    subline: monthSub,
    insight: monthInsight,
    progressPercent: null,
  };

  const temporal: Record<TemporalViewKey, OmnipresentKpiBlock> = {
    day: dayBlock,
    week: weekBlock,
    month: monthBlock,
  };

  const smartCards: SmartCardItem[] = [];

  const topProduct = extras?.topProduct;
  if (topProduct) {
    smartCards.push({
      id: 'champion',
      emoji: '🥇',
      title: pilotageT('card_champion_title'),
      body: pilotageT('card_champion_body_product', {
        name: topProduct.name,
        pct: Math.round(topProduct.marginSharePct),
      }),
    });
  } else {
    const noteTop = topNoteFromEvents(monthVisits);
    if (noteTop) {
      smartCards.push({
        id: 'champion',
        emoji: '🥇',
        title: pilotageT('card_champion_title_caisse'),
        body: pilotageT('card_champion_body_note', {
          text: noteTop.text,
          count: noteTop.count,
        }),
      });
    } else {
      smartCards.push({
        id: 'champion',
        emoji: '🥇',
        title: pilotageT('card_champion_title'),
        body: pilotageT('card_champion_body_empty'),
      });
    }
  }

  const stock = extras?.stock;
  if (stock) {
    smartCards.push({
      id: 'stock',
      emoji: '🚨',
      title: pilotageT('card_stock_title'),
      body: pilotageT('card_stock_body_ratio', {
        label: stock.label,
        ratio: stock.ratioVsForecast.toLocaleString(loc, { maximumFractionDigits: 1 }),
      }),
    });
  } else {
    smartCards.push({
      id: 'stock',
      emoji: '🚨',
      title: pilotageT('card_stock_title'),
      body: pilotageT('card_stock_body_empty'),
    });
  }

  const spendByMember = new Map<string, number>();
  for (const e of monthVisits) {
    spendByMember.set(e.member_id, (spendByMember.get(e.member_id) ?? 0) + (e.amount_cents ?? 0));
  }
  let vipId: string | null = null;
  let vipScore = -1;
  for (const [mid, cents] of spendByMember) {
    if (cents > vipScore) {
      vipScore = cents;
      vipId = mid;
    }
  }
  if (vipId && vipScore > 0) {
    const memV = memberById.get(vipId);
    if (memV) {
      const nm = displayMemberName(memV, defLabel);
      const visitCount =
        monthVisits.filter((e) => e.member_id === vipId && VISIT_EVENTS.has(e.event_type)).length ||
        1;
      const period = monthInProgressPeriodLabel(now, loc, pilotageT);
      smartCards.push({
        id: 'vip',
        emoji: '💎',
        title: pilotageT('card_vip_title'),
        body: pilotageT('card_vip_body_spend_named', {
          period,
          name: nm,
          amount: fmt(vipScore),
        }),
        vipContact: vipContactFrom(vipId, memV, vipScore, visitCount, 'spend', defLabel),
      });
    } else {
      const period = monthInProgressPeriodLabel(now, loc, pilotageT);
      smartCards.push({
        id: 'vip',
        emoji: '💎',
        title: pilotageT('card_vip_title'),
        body: pilotageT('card_vip_body_spend_anon', {
          period,
          amount: fmt(vipScore),
        }),
      });
    }
  } else {
    const visitsByMember = new Map<string, number>();
    for (const e of monthVisits) {
      visitsByMember.set(e.member_id, (visitsByMember.get(e.member_id) ?? 0) + 1);
    }
    let topV: string | null = null;
    let topC = 0;
    for (const [mid, c] of visitsByMember) {
      if (c > topC) {
        topC = c;
        topV = mid;
      }
    }
    if (topV && topC >= 2) {
      const memV = memberById.get(topV);
      if (memV) {
        const nm = displayMemberName(memV, defLabel);
        const spendFallback = spendByMember.get(topV) ?? 0;
        const period = monthInProgressPeriodLabel(now, loc, pilotageT);
        smartCards.push({
          id: 'vip',
          emoji: '💎',
          title: pilotageT('card_vip_title'),
          body: pilotageT('card_vip_body_visits_named', {
            period,
            name: nm,
            count: topC,
          }),
          vipContact: vipContactFrom(topV, memV, spendFallback, topC, 'visits', defLabel),
        });
      } else {
        const period = monthInProgressPeriodLabel(now, loc, pilotageT);
        smartCards.push({
          id: 'vip',
          emoji: '💎',
          title: pilotageT('card_vip_title'),
          body: pilotageT('card_vip_body_visits_anon', {
            period,
            count: topC,
          }),
        });
      }
    } else {
      const period = monthInProgressPeriodLabel(now, loc, pilotageT);
      smartCards.push({
        id: 'vip',
        emoji: '💎',
        title: pilotageT('card_vip_title'),
        body: pilotageT('card_vip_body_low_activity', { period }),
      });
    }
  }

  const cutoff = new Date(now.getTime() - inactiveDays * 86400000);
  let atRisk = 0;
  for (const m of members) {
    const visits = m.lifetime_visit_count ?? 0;
    if (visits < minLifetimeVisits) continue;
    if (!m.last_visit_at) continue;
    if (parseISO(m.last_visit_at) < cutoff) atRisk++;
  }

  if (atRisk > 0) {
    smartCards.push({
      id: 'risk',
      emoji: '📉',
      title: pilotageT('card_risk_title'),
      body: pilotageT('card_risk_body_at_risk', {
        count: atRisk,
        minVisits: minLifetimeVisits,
        inactiveDays,
      }),
      ctaLabel: pilotageT('card_risk_cta_clients'),
      href: '/dashboard/whatsapp-review?tab=clients',
      whatsappRelaunch: true,
    });
  } else {
    smartCards.push({
      id: 'risk',
      emoji: '📉',
      title: pilotageT('card_risk_title'),
      body: pilotageT('card_risk_body_safe', {
        minVisits: minLifetimeVisits,
        inactiveDays,
      }),
    });
  }

  return {
    temporal,
    smartCards,
    generatedAt: now.toISOString(),
    hasTicketAmounts,
    dailyActivity,
  } satisfies PilotageCorePayload;
}
