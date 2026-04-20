import { endOfDay, parseISO, startOfDay, subDays } from 'date-fns';
import type { LoyaltyEventRow, MemberRow } from '@/lib/banano/pilotage/build-pilotage-dashboard';
import type {
  RetentionFunnelDetail,
  RetentionFunnelSnapshot,
  WeekdayHeatCell,
} from '@/lib/banano/pilotage/types';

const EARN = new Set(['earn_points', 'earn_stamps']);

function memberLabel(m: MemberRow, defaultMemberLabel: string): string {
  const f = (m.first_name ?? '').trim();
  const l = (m.last_name ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  return (m.display_name ?? '').trim() || defaultMemberLabel;
}

/**
 * Entonnoir rétention (même fenêtre mois que le CA pilotage) + activité par jour de semaine sur 7 jours.
 */
export function computeRetentionAndWeekdayHeat(
  now: Date,
  events: LoyaltyEventRow[],
  members: MemberRow[],
  monthStartIso: string,
  monthEndExclusiveIso: string,
  defaultMemberLabel: string
): { funnel: RetentionFunnelSnapshot; heat: WeekdayHeatCell[]; funnelDetail: RetentionFunnelDetail } {
  const newMembersList = members.filter((m) => {
    const ca = m.created_at;
    if (!ca || typeof ca !== 'string') return false;
    const t = ca;
    return t >= monthStartIso && t < monthEndExclusiveIso;
  });
  const newClientsThisMonth = newMembersList.length;

  const visitsByMemberMonth = new Map<string, number>();
  for (const e of events) {
    if (!EARN.has(e.event_type)) continue;
    const t = String(e.created_at ?? '');
    if (t < monthStartIso || t >= monthEndExclusiveIso) continue;
    visitsByMemberMonth.set(e.member_id, (visitsByMemberMonth.get(e.member_id) ?? 0) + 1);
  }

  let returnedAtLeastTwiceThisMonth = 0;
  const returnedRows: { id: string; label: string; visitsInMonth: number }[] = [];
  const memberById = new Map(members.map((m) => [m.id, m]));
  for (const [mid, v] of visitsByMemberMonth.entries()) {
    if (v >= 2) {
      returnedAtLeastTwiceThisMonth++;
      const mm = memberById.get(mid);
      if (mm) {
        returnedRows.push({ id: mid, label: memberLabel(mm, defaultMemberLabel), visitsInMonth: v });
      }
    }
  }
  returnedRows.sort((a, b) => b.visitsInMonth - a.visitsInMonth || a.label.localeCompare(b.label));

  const vipMembersList = members.filter((m) => (m.lifetime_visit_count ?? 0) >= 3);
  const vipProfilesCount = vipMembersList.length;
  const vipRows = vipMembersList
    .map((m) => ({
      id: m.id,
      label: memberLabel(m, defaultMemberLabel),
      lifetimeVisits: Math.max(0, Math.floor(Number(m.lifetime_visit_count ?? 0))),
    }))
    .sort((a, b) => b.lifetimeVisits - a.lifetimeVisits || a.label.localeCompare(b.label));

  const heatStart = startOfDay(subDays(now, 6));
  const heatEnd = endOfDay(now);
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const e of events) {
    if (!EARN.has(e.event_type)) continue;
    try {
      const t = parseISO(e.created_at).getTime();
      if (Number.isNaN(t) || t < heatStart.getTime() || t > heatEnd.getTime()) continue;
      const d = new Date(t);
      const dowMon0 = (d.getDay() + 6) % 7;
      counts[dowMon0]++;
    } catch {
      /* skip */
    }
  }

  const heat: WeekdayHeatCell[] = counts.map((count, dow) => ({ dow, count }));

  return {
    funnel: {
      newClientsThisMonth,
      returnedAtLeastTwiceThisMonth,
      vipProfilesCount,
    },
    heat,
    funnelDetail: {
      newMembers: newMembersList
        .map((m) => ({ id: m.id, label: memberLabel(m, defaultMemberLabel) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      returnedTwice: returnedRows,
      vipProfiles: vipRows,
    },
  };
}
