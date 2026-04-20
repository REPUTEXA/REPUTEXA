import { eachDayOfInterval, endOfWeek, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { LoyaltyEventRow, MemberRow } from '@/lib/banano/pilotage/build-pilotage-dashboard';
import { siteLocaleToDateFnsLocale } from '@/lib/banano/pilotage/date-locale';
import type {
  PilotageCalendarCell,
  PilotageCalendarMonthBundle,
  PilotageCashDeskMetrics,
  PilotageFeedWallItem,
} from '@/lib/banano/pilotage/operational-types';

const VISIT = new Set(['earn_points', 'earn_stamps']);

type UiT = (key: string, values?: Record<string, string | number | boolean | Date>) => string;

function memberDisplayName(
  m: { display_name: string | null; first_name: string | null; last_name: string | null },
  fallback: string
): string {
  const f = (m.first_name ?? '').trim();
  const l = (m.last_name ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  return (m.display_name ?? '').trim() || fallback;
}

/** Fenêtre [fromIso, toExclusiveIso) pour le mois calendaire contenant `calRef`, en fuseau marchand. */
export function monthWindowInTimeZone(
  calRef: Date,
  timeZone: string
): { fromIso: string; toExclusiveIso: string } {
  const z = toZonedTime(calRef, timeZone);
  const y = z.getFullYear();
  const m0 = z.getMonth();
  const from = fromZonedTime(new Date(y, m0, 1, 0, 0, 0, 0), timeZone);
  const toEx = fromZonedTime(new Date(y, m0 + 1, 1, 0, 0, 0, 0), timeZone);
  return { fromIso: from.toISOString(), toExclusiveIso: toEx.toISOString() };
}

/** Journée civile courante dans le fuseau marchand. */
export function todayWindowInTimeZone(
  now: Date,
  timeZone: string
): { fromIso: string; toExclusiveIso: string } {
  const z = toZonedTime(now, timeZone);
  const y = z.getFullYear();
  const m0 = z.getMonth();
  const d = z.getDate();
  const from = fromZonedTime(new Date(y, m0, d, 0, 0, 0, 0), timeZone);
  const toEx = fromZonedTime(new Date(y, m0, d + 1, 0, 0, 0, 0), timeZone);
  return { fromIso: from.toISOString(), toExclusiveIso: toEx.toISOString() };
}

export function computeCashDeskMetrics(
  events: LoyaltyEventRow[],
  members: MemberRow[],
  fromIso: string,
  toExclusiveIso: string
): PilotageCashDeskMetrics {
  const memberById = new Map(members.map((m) => [m.id, m]));
  let walletRevenueCents = 0;
  let loyalWalletRevenueCents = 0;
  let casualWalletRevenueCents = 0;
  let walletVisitCount = 0;
  let visitsWithAmountCount = 0;
  let visitsWithStaffCount = 0;
  let loyalVisitEventCount = 0;
  let casualVisitEventCount = 0;
  const seenMembers = new Set<string>();

  for (const e of events) {
    if (!VISIT.has(e.event_type)) continue;
    const t = String(e.created_at ?? '');
    if (t < fromIso || t >= toExclusiveIso) continue;
    walletVisitCount++;
    const mid = e.member_id;
    const mm = memberById.get(mid);
    const visitsLife = Math.max(0, Math.floor(Number(mm?.lifetime_visit_count ?? 0)));
    const loyal = visitsLife >= 3;
    const amt = Math.max(0, Math.floor(Number(e.amount_cents ?? 0)));
    walletRevenueCents += amt;
    if (loyal) {
      loyalWalletRevenueCents += amt;
      loyalVisitEventCount++;
    } else {
      casualWalletRevenueCents += amt;
      casualVisitEventCount++;
    }
    if (amt > 0) visitsWithAmountCount++;
    if (e.staff_id != null && String(e.staff_id).length > 0) visitsWithStaffCount++;
    seenMembers.add(mid);
  }

  const avg = (sum: number, n: number) => (n > 0 ? Math.round(sum / n) : null);

  return {
    fromIso,
    toExclusiveIso,
    walletRevenueCents,
    loyalWalletRevenueCents,
    casualWalletRevenueCents,
    walletVisitCount,
    visitsWithAmountCount,
    visitsWithStaffCount,
    avgBasketWalletCents: avg(walletRevenueCents, visitsWithAmountCount),
    avgBasketLoyalMemberCents: avg(loyalWalletRevenueCents, loyalVisitEventCount),
    avgBasketCasualMemberCents: avg(casualWalletRevenueCents, casualVisitEventCount),
    loyalVisitEventCount,
    casualVisitEventCount,
    uniqueWalletMembersWithVisit: seenMembers.size,
  };
}

export function buildCalendarMonthCells(
  events: LoyaltyEventRow[],
  calRef: Date,
  merchantTz: string,
  siteLocale: string
): PilotageCalendarMonthBundle {
  const z = toZonedTime(calRef, merchantTz);
  const year = z.getFullYear();
  const month = z.getMonth() + 1;
  const m0 = month - 1;
  const loc = siteLocaleToDateFnsLocale(siteLocale);

  const monthStartUtc = fromZonedTime(new Date(year, m0, 1, 0, 0, 0, 0), merchantTz);
  const monthEndUtc = fromZonedTime(new Date(year, m0 + 1, 1, 0, 0, 0, 0), merchantTz);
  const monthLabelRaw = formatInTimeZone(monthStartUtc, merchantTz, 'MMMM yyyy', { locale: loc });
  const labelCap = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  const firstGrid = startOfWeek(monthStartUtc, { weekStartsOn: 1 });
  const lastInstantOfMonth = new Date(monthEndUtc.getTime() - 1);
  const lastGrid = endOfWeek(lastInstantOfMonth, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: firstGrid, end: lastGrid });

  const cells: PilotageCalendarCell[] = days.map((dayUtc) => {
    const ymd = formatInTimeZone(dayUtc, merchantTz, 'yyyy-MM-dd');
    const parts = ymd.split('-').map(Number);
    const y = parts[0]!;
    const mo = parts[1]!;
    const da = parts[2]!;
    const dayStart = fromZonedTime(new Date(y, mo - 1, da, 0, 0, 0, 0), merchantTz);
    const dayEnd = fromZonedTime(new Date(y, mo - 1, da + 1, 0, 0, 0, 0), merchantTz);
    const fromIso = dayStart.toISOString();
    const toEx = dayEnd.toISOString();
    let visitCount = 0;
    let stampCount = 0;
    let revenueCents = 0;
    for (const e of events) {
      if (!VISIT.has(e.event_type)) continue;
      const t = String(e.created_at ?? '');
      if (t < fromIso || t >= toEx) continue;
      visitCount++;
      revenueCents += Math.max(0, Math.floor(Number(e.amount_cents ?? 0)));
      if (e.event_type === 'earn_stamps') stampCount++;
    }
    const inMonth = y === year && mo === month;
    return {
      dateKey: ymd,
      dayNum: da,
      visitCount,
      stampCount,
      revenueCents,
      isInMonth: inMonth,
    };
  });

  return { year, month, monthLabel: labelCap, cells };
}

export function buildPilotageFeedWallItems(
  rawFeed: Array<{
    id: string;
    created_at: string;
    event_type: string;
    member_id: string;
    amount_cents?: number | null;
    delta_points?: number | null;
    delta_stamps?: number | null;
  }>,
  feedMemberMap: Map<
    string,
    { display_name: string | null; first_name: string | null; last_name: string | null }
  >,
  tUi: UiT,
  locale: string
): PilotageFeedWallItem[] {
  const fallback = tUi('feedDefaultClient');
  const fmtEur = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  return rawFeed.map((e) => {
    const m = feedMemberMap.get(e.member_id);
    const name = m ? memberDisplayName(m, fallback) : fallback;
    const cents =
      e.amount_cents != null && Number.isFinite(Number(e.amount_cents))
        ? Math.max(0, Math.floor(Number(e.amount_cents)))
        : null;
    const et = String(e.event_type ?? '');
    let summaryLine: string;
    switch (et) {
      case 'member_created':
        summaryLine = tUi('feedTitleMemberCreated', { name });
        break;
      case 'earn_points':
        summaryLine = tUi('feedTitleEarnPoints', {
          name,
          points: Math.max(0, Math.floor(Number(e.delta_points ?? 0))),
        });
        break;
      case 'earn_stamps':
        summaryLine = tUi('feedTitleEarnStamps', {
          name,
          stamps: Math.max(0, Math.floor(Number(e.delta_stamps ?? 0))),
        });
        break;
      case 'voucher_redeemed':
        summaryLine =
          cents != null && cents > 0
            ? `${tUi('feedTitleVoucherRedeemed', { name })} · ${tUi('feedSubAmount', { amount: fmtEur(cents) })}`
            : tUi('feedTitleVoucherRedeemed', { name });
        break;
      case 'encaisser_reward':
        summaryLine = tUi('feedTitleEncaisserReward', { name });
        break;
      case 'voucher_issued':
        summaryLine = tUi('feedTitleVoucherIssued', { name });
        break;
      default:
        summaryLine = tUi('feedTitleGeneric', { name });
    }
    return {
      id: String(e.id ?? ''),
      createdAt: String(e.created_at ?? ''),
      eventType: et,
      memberId: String(e.member_id ?? ''),
      memberLabel: name,
      amountCents: cents,
      summaryLine,
    };
  });
}
