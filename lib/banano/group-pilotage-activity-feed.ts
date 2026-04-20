export type PilotageActivityFeedItem = {
  id: string;
  at: string;
  line: string;
  member_id: string;
  event_type: string;
  client_name: string;
  staff_name: string | null;
};

export type GroupedPilotageActivityFeed = {
  key: string;
  displayLine: string;
  detailLines: string[];
};

type GroupFormatter = (args: {
  count: number;
  clientName: string;
  eventTypes: string[];
  staffName: string | null;
  at: string;
}) => string;

const MERGE_TYPES = new Set(['voucher_redeemed', 'earn_points', 'earn_stamps']);

/**
 * Regroupe des lignes consécutives (même client, même équipier, même minute) pour alléger le fil.
 */
export function groupPilotageActivityFeed(
  lines: PilotageActivityFeedItem[],
  formatGroup: GroupFormatter
): GroupedPilotageActivityFeed[] {
  if (lines.length === 0) return [];
  const groups: GroupedPilotageActivityFeed[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i]!;
    const bucket: PilotageActivityFeedItem[] = [cur];
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j]!;
      const sameClient = next.member_id === cur.member_id;
      const sameStaff = (next.staff_name ?? '') === (cur.staff_name ?? '');
      const sameMinute = next.at.slice(0, 16) === cur.at.slice(0, 16);
      if (
        sameClient &&
        sameStaff &&
        sameMinute &&
        MERGE_TYPES.has(cur.event_type) &&
        MERGE_TYPES.has(next.event_type)
      ) {
        bucket.push(next);
        j++;
      } else {
        break;
      }
    }

    const eventTypes = bucket.map((b) => b.event_type);
    const displayLine =
      bucket.length > 1
        ? formatGroup({
            count: bucket.length,
            clientName: cur.client_name,
            eventTypes,
            staffName: cur.staff_name,
            at: cur.at,
          })
        : cur.line;
    const detailLines = bucket.length > 1 ? bucket.map((b) => b.line) : [];

    groups.push({
      key: `grp-${cur.id}-${i}`,
      displayLine,
      detailLines,
    });
    i = j;
  }
  return groups;
}
