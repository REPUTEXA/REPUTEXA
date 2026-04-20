import type { ProspectStatus } from '@prisma/client';

export type ProspectMapPhase =
  | 'scanned'
  | 'outreach_recent'
  | 'no_response'
  | 'engaged'
  | 'opted_out'
  | 'customer'
  | 'lost'
  | 'trial';

type PhaseInput = {
  status: ProspectStatus;
  optedOutAt: Date | null;
  lastOutreachAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Agrège un statut « carte » pour la War Room (prospects). */
export function prospectMapPhase(p: PhaseInput): ProspectMapPhase {
  if (p.optedOutAt || p.status === 'OPTED_OUT') return 'opted_out';
  if (p.status === 'LOST') return 'lost';
  if (p.status === 'CONVERTED') return 'customer';
  if (p.status === 'TRIAL') return 'trial';
  if (p.status === 'TO_CONTACT' && !p.lastOutreachAt) return 'scanned';
  const recent =
    p.lastOutreachAt != null && Date.now() - new Date(p.lastOutreachAt).getTime() < DAY_MS;
  if (recent) return 'outreach_recent';
  if (p.openedAt || p.clickedAt) return 'engaged';
  if (p.lastOutreachAt) return 'no_response';
  return 'scanned';
}
