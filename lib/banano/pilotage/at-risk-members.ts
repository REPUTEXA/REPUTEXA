import { differenceInCalendarDays, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { MemberRow } from '@/lib/banano/pilotage/build-pilotage-dashboard';
import type { PilotageAtRiskMember } from '@/lib/banano/pilotage/operational-types';

const MIN_LIFETIME_VISITS = 3;
/** Aligné sur une fenêtre « client endormi » courte (affichage deck). */
const INACTIVE_DAYS_THRESHOLD = 35;

function memberLabel(m: MemberRow, defaultMemberLabel: string): string {
  const f = (m.first_name ?? '').trim();
  const l = (m.last_name ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  return (m.display_name ?? '').trim() || defaultMemberLabel;
}

export function computeAtRiskMembers(
  now: Date,
  merchantTz: string,
  members: MemberRow[],
  defaultMemberLabel: string
): PilotageAtRiskMember[] {
  const zNow = toZonedTime(now, merchantTz);
  const out: PilotageAtRiskMember[] = [];

  for (const m of members) {
    const life = Math.max(0, Math.floor(Number(m.lifetime_visit_count ?? 0)));
    if (life < MIN_LIFETIME_VISITS) continue;
    const lastRaw = m.last_visit_at;
    if (!lastRaw || typeof lastRaw !== 'string') continue;
    let last: Date;
    try {
      last = parseISO(lastRaw);
      if (Number.isNaN(last.getTime())) continue;
    } catch {
      continue;
    }
    const days = differenceInCalendarDays(zNow, toZonedTime(last, merchantTz));
    if (days < INACTIVE_DAYS_THRESHOLD) continue;

    out.push({
      memberId: m.id,
      displayLabel: memberLabel(m, defaultMemberLabel),
      phoneE164: m.phone_e164 != null && String(m.phone_e164).trim() ? String(m.phone_e164).trim() : null,
      daysSinceVisit: days,
      lifetimeVisits: life,
      lastVisitAt: lastRaw,
    });
  }

  out.sort(
    (a, b) =>
      (b.daysSinceVisit ?? 0) - (a.daysSinceVisit ?? 0) ||
      a.displayLabel.localeCompare(b.displayLabel, 'fr')
  );

  return out.slice(0, 80);
}
