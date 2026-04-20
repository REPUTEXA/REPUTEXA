import { endOfMonth, format, startOfMonth } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { siteLocaleToDateFnsLocale } from '@/lib/banano/pilotage/date-locale';
import { reviewMatchesMember } from '@/lib/banano/review-matches-member';

export type BananoStaffMonthStatRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  clientsCreated: number;
  revenueCents: number;
  googlePositiveReviews: number;
  ticketsEncaisse: number;
  transformPercent: number;
  avgBasketCents: number;
};

export type BananoStaffMonthStatsResult = {
  monthStartIso: string;
  monthEndExclusiveIso: string;
  /** Libellé du mois selon la locale demandée (ex. « février 2026 » / « February 2026 »). */
  monthLabel: string;
  rows: BananoStaffMonthStatRow[];
  /** Déprécié : préférer les messages i18n côté client (`Dashboard.bananoOmnipresent.staffGoogleDisclaimer`). */
  disclaimer: string;
};

function monthBounds(
  periodStart: Date,
  siteLocale = 'fr'
): { fromIso: string; toExclusiveIso: string; label: string } {
  const from = startOfMonth(periodStart);
  const end = endOfMonth(periodStart);
  const toExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0);
  const loc = siteLocaleToDateFnsLocale(siteLocale);
  let label: string;
  try {
    label = format(from, 'MMMM yyyy', { locale: loc });
  } catch {
    label = format(from, 'yyyy-MM');
  }
  return {
    fromIso: from.toISOString(),
    toExclusiveIso: toExclusive.toISOString(),
    label,
  };
}

/**
 * Stats équipiers pour un mois calendaire (même logique que le pilotage : lt fin mois exclusive).
 */
export async function fetchBananoStaffMonthStats(
  supabase: SupabaseClient,
  userId: string,
  periodStart: Date,
  siteLocale = 'fr'
): Promise<BananoStaffMonthStatsResult> {
  const { fromIso, toExclusiveIso, label } = monthBounds(periodStart, siteLocale);

  const { data: staffRows, error: staffErr } = await supabase
    .from('banano_terminal_staff')
    .select('id, display_name, is_active')
    .eq('user_id', userId)
    .order('display_name', { ascending: true });

  if (staffErr) {
    throw new Error(staffErr.message);
  }

  const staffList = staffRows ?? [];
  if (staffList.length === 0) {
    return {
      monthStartIso: fromIso,
      monthEndExclusiveIso: toExclusiveIso,
      monthLabel: label,
      rows: [],
      disclaimer: '',
    };
  }

  const staffIds = staffList.map((s) => s.id);

  const { data: createdRows, error: cErr } = await supabase
    .from('banano_loyalty_members')
    .select('created_by_staff_id')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso)
    .not('created_by_staff_id', 'is', null);

  if (cErr) {
    throw new Error(cErr.message);
  }

  const createdByStaff = new Map<string, number>();
  for (const r of createdRows ?? []) {
    const sid = (r as { created_by_staff_id: string }).created_by_staff_id;
    if (!sid || !staffIds.includes(sid)) continue;
    createdByStaff.set(sid, (createdByStaff.get(sid) ?? 0) + 1);
  }

  const { data: earnEv, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('member_id, staff_id, amount_cents, event_type')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso)
    .in('event_type', ['earn_points', 'earn_stamps']);

  if (evErr) {
    throw new Error(evErr.message);
  }

  const revenueByStaff = new Map<string, number>();
  const ticketsByStaff = new Map<string, number>();
  const staffMemberEarnMonth = new Map<string, Set<string>>();
  for (const e of earnEv ?? []) {
    const sid = (e as { staff_id: string | null }).staff_id;
    if (!sid || !staffIds.includes(sid)) continue;
    ticketsByStaff.set(sid, (ticketsByStaff.get(sid) ?? 0) + 1);
    const cents = Math.max(0, Math.floor(Number((e as { amount_cents?: number }).amount_cents ?? 0)));
    if (cents > 0) revenueByStaff.set(sid, (revenueByStaff.get(sid) ?? 0) + cents);
    const memId = (e as { member_id?: string }).member_id;
    if (typeof memId === 'string' && memId) {
      if (!staffMemberEarnMonth.has(sid)) staffMemberEarnMonth.set(sid, new Set());
      staffMemberEarnMonth.get(sid)!.add(memId);
    }
  }

  const { data: members, error: mErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, first_name, last_name')
    .eq('user_id', userId);

  if (mErr) {
    throw new Error(mErr.message);
  }

  const memberList = (members ?? []) as Array<{
    id: string;
    display_name: string;
    first_name?: string | null;
    last_name?: string | null;
  }>;

  const { data: reviewsRaw, error: rErr } = await supabase
    .from('reviews')
    .select('id, reviewer_name, rating, created_at, source')
    .eq('user_id', userId)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso)
    .gte('rating', 4);

  if (rErr) {
    throw new Error(rErr.message);
  }

  const googleReviews = (reviewsRaw ?? []).filter((r) => {
    const src = String((r as { source?: string }).source ?? '').toLowerCase();
    return src.includes('google');
  });

  const googleByStaff = new Map<string, number>();
  for (const st of staffIds) googleByStaff.set(st, 0);

  for (const r of googleReviews) {
    const rev = r as { reviewer_name: string };
    const matchedMember = memberList.find((m) => reviewMatchesMember(rev, m));
    if (!matchedMember) continue;
    for (const st of staffIds) {
      if (staffMemberEarnMonth.get(st)?.has(matchedMember.id)) {
        googleByStaff.set(st, (googleByStaff.get(st) ?? 0) + 1);
      }
    }
  }

  const rows: BananoStaffMonthStatRow[] = staffList.map((s) => {
    const tickets = ticketsByStaff.get(s.id) ?? 0;
    const rev = revenueByStaff.get(s.id) ?? 0;
    const cc = createdByStaff.get(s.id) ?? 0;
    const transformPercent =
      tickets > 0 ? Math.min(100, Math.round((cc * 1000) / tickets) / 10) : 0;
    const avgBasketCents = tickets > 0 ? Math.round(rev / tickets) : 0;
    return {
      id: s.id,
      display_name: s.display_name,
      is_active: s.is_active,
      clientsCreated: cc,
      revenueCents: rev,
      googlePositiveReviews: googleByStaff.get(s.id) ?? 0,
      ticketsEncaisse: tickets,
      transformPercent,
      avgBasketCents,
    };
  });

  rows.sort(
    (a, b) =>
      b.revenueCents - a.revenueCents ||
      b.clientsCreated - a.clientsCreated ||
      b.ticketsEncaisse - a.ticketsEncaisse
  );

  return {
    monthStartIso: fromIso,
    monthEndExclusiveIso: toExclusiveIso,
    monthLabel: label,
    rows,
    disclaimer: '',
  };
}
