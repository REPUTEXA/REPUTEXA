export type LoyaltyEventRow = {
  id: string;
  event_type: string;
  delta_points: number;
  delta_stamps: number;
  note: string | null;
  created_at: string;
  /** Nb articles / lignes ticket (caisse), si renseigné. */
  items_count?: number | null;
  /** Prénom / nom affiché équipier (joint côté API). */
  staff_display_name?: string | null;
};

export type ReviewTimelineRow = {
  id: string;
  rating: number;
  created_at: string;
  source: string | null;
};

export type TimelineDetailRow = { label: string; value: string };

export type TimelineItem = {
  id: string;
  kind: 'loyalty' | 'review';
  at: string;
  label: string;
  detail: {
    title: string;
    rows: TimelineDetailRow[];
  };
};

/**
 * Jour J anniversaire : compare MM-DD (date SQL yyyy-mm-dd) au jour courant.
 * Si `timeZone` IANA est fourni, comparaison dans ce fuseau (établissement).
 */
export function isBirthdayToday(
  birthDate: string | null | undefined,
  timeZone?: string | null
): boolean {
  if (!birthDate || typeof birthDate !== 'string') return false;
  const md = birthDate.slice(5, 10);
  if (md.length !== 5 || md[2] !== '-') return false;
  const now = new Date();
  const tz = (timeZone ?? '').trim();
  let todayMd: string;
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en', {
        timeZone: tz,
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);
      const m = parts.find((p) => p.type === 'month')?.value ?? '01';
      const d = parts.find((p) => p.type === 'day')?.value ?? '01';
      todayMd = `${m}-${d}`;
    } catch {
      todayMd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
  } else {
    todayMd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return md === todayMd;
}
