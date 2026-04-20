import type { SupabaseClient } from '@supabase/supabase-js';

export type EliteTopMemberRow = {
  rank: number;
  memberId: string;
  displayName: string;
  firstName: string | null;
  phoneE164: string;
  visitCount: number;
  revenueCents: number;
  /** Most frequent tokens from visit notes (ticket detail lines at checkout). */
  topNoteLabels: string[];
  /** Single “signature” line: most common note token vs. empty. */
  favoriteDetail: string | null;
};

const EARN_TYPES = ['earn_points', 'earn_stamps'] as const;

/** UTC month [start, endExclusive) from `YYYY-MM`. */
export function eliteMonthBoundsUtc(monthKey: string): { fromIso: string; toExclusiveIso: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const from = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const toExclusive = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  return { fromIso: from.toISOString(), toExclusiveIso: toExclusive.toISOString() };
}

/**
 * Heuristic: split free-text visit notes (e.g. "2× Merguez, café") into comparable tokens.
 */
export function tokenizeVisitNote(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length < 2) return [];
  const parts = s.split(/[,;•|/]|\s+×\s+|×|\n+/);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.replace(/^[\s\-–]+|[\s\-–]+$/g, '').trim();
    if (t.length >= 2 && t.length <= 120) out.push(t);
  }
  return out;
}

function topTokensFromCounts(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .filter(([k]) => k.length >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

/**
 * Top members by revenue (ticket amounts) over earn visits in the month, then by visit count.
 */
export async function fetchEliteTopClients(
  supabase: SupabaseClient,
  merchantUserId: string,
  monthKey: string,
  options?: { limit?: number; maxEventRows?: number }
): Promise<{ rows: EliteTopMemberRow[]; monthKey: string; fromIso: string; toExclusiveIso: string }> {
  const bounds = eliteMonthBoundsUtc(monthKey);
  if (!bounds) {
    throw new Error('invalid_month_key');
  }
  const limit = Math.min(50, Math.max(1, options?.limit ?? 5));
  const maxRows = Math.min(50_000, Math.max(1000, options?.maxEventRows ?? 20_000));

  const { data: evs, error } = await supabase
    .from('banano_loyalty_events')
    .select('member_id, amount_cents, note, event_type')
    .eq('user_id', merchantUserId)
    .gte('created_at', bounds.fromIso)
    .lt('created_at', bounds.toExclusiveIso)
    .in('event_type', [...EARN_TYPES])
    .limit(maxRows);

  if (error) {
    throw new Error(error.message);
  }

  type Agg = {
    visits: number;
    revenueCents: number;
    noteTokens: Map<string, number>;
  };
  const byMember = new Map<string, Agg>();

  for (const row of evs ?? []) {
    const mid = (row as { member_id?: string }).member_id;
    if (!mid || typeof mid !== 'string') continue;
    let agg = byMember.get(mid);
    if (!agg) {
      agg = { visits: 0, revenueCents: 0, noteTokens: new Map() };
      byMember.set(mid, agg);
    }
    agg.visits += 1;
    const cents = Math.max(0, Math.floor(Number((row as { amount_cents?: number }).amount_cents ?? 0)));
    agg.revenueCents += cents;
    const note = (row as { note?: string | null }).note;
    for (const tok of tokenizeVisitNote(note)) {
      const key = tok.slice(0, 200);
      agg.noteTokens.set(key, (agg.noteTokens.get(key) ?? 0) + 1);
    }
  }

  const memberIds = [...byMember.keys()];
  if (memberIds.length === 0) {
    return { rows: [], monthKey, ...bounds };
  }

  const { data: members, error: mErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, first_name, phone_e164')
    .eq('user_id', merchantUserId)
    .in('id', memberIds);

  if (mErr) {
    throw new Error(mErr.message);
  }

  const memberMap = new Map(
    (members ?? []).map((m) => [
      (m as { id: string }).id,
      m as { id: string; display_name?: string; first_name?: string | null; phone_e164?: string },
    ])
  );

  const scored: EliteTopMemberRow[] = [];
  for (const [memberId, agg] of byMember) {
    const m = memberMap.get(memberId);
    const displayName = (m?.display_name ?? '').trim() || '—';
    const firstName = m?.first_name != null ? String(m.first_name).trim() || null : null;
    const phoneE164 = String(m?.phone_e164 ?? '').trim() || '';
    const topNoteLabels = topTokensFromCounts(agg.noteTokens, 5);
    const favoriteDetail = topNoteLabels[0] ?? null;
    scored.push({
      rank: 0,
      memberId,
      displayName,
      firstName,
      phoneE164,
      visitCount: agg.visits,
      revenueCents: agg.revenueCents,
      topNoteLabels,
      favoriteDetail,
    });
  }

  scored.sort(
    (a, b) =>
      b.revenueCents - a.revenueCents ||
      b.visitCount - a.visitCount ||
      a.displayName.localeCompare(b.displayName)
  );

  const top = scored.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));

  return { rows: top, monthKey, ...bounds };
}
