/**
 * Predicates for keyset pagination with PostgREST `.or()` (ORDER BY … DESC, stable tie-break on id).
 * Tuple (a DESC, id DESC): fetch rows strictly “after” cursor row = smaller a, or same a and smaller id.
 */

export function quotePostgrestValue(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim()
  );
}

export function parseCursorIso(iso: string | null): string | null {
  if (!iso || !iso.trim()) return null;
  const t = decodeURIComponent(iso.trim());
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ORDER BY col DESC, id DESC */
export function orKeysetDesc2(col: string, colIso: string, id: string): string {
  const qc = quotePostgrestValue(colIso);
  const qi = quotePostgrestValue(id);
  return `and(${col}.eq.${qc},id.lt.${qi}),${col}.lt.${qc}`;
}

/** ORDER BY priority_score DESC, created_at DESC, id DESC */
export function orKeysetDescPriorityCreated(
  priorityScore: number,
  createdAtIso: string,
  id: string
): string {
  if (!Number.isFinite(priorityScore)) return '';
  const qc = quotePostgrestValue(createdAtIso);
  const qi = quotePostgrestValue(id);
  return [
    `priority_score.lt.${priorityScore}`,
    `and(priority_score.eq.${priorityScore},created_at.lt.${qc})`,
    `and(priority_score.eq.${priorityScore},created_at.eq.${qc},id.lt.${qi})`,
  ].join(',');
}

export function isValidIsoParam(raw: string | null): boolean {
  return parseCursorIso(raw) !== null;
}
