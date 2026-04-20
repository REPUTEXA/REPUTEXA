import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_OPERATOR_CHECKLIST_KEY = 'admin_operator_checklist';

const MAX_LOG_ENTRIES = 120;
const MAX_SNAPSHOTS = 48;

/** Stable ids — prefixes: d_ daily, w_ weekly, m_ monthly, o_ one-off */
export const OPERATOR_CHECKLIST_IDS = [
  'd_hub_pulse',
  'd_security_badge',
  'd_ghost_shield',
  'd_nexus_slack',
  'd_clients_fire',
  'd_legal_guardian_inbox',
  'w_security_audit',
  'w_blackbox_sample',
  'w_ia_queue',
  'w_guardian_stats',
  'w_sentinel_compliance',
  'w_council_digest',
  'm_dpia_review',
  'm_subprocessors_csv',
  'm_investor_archive',
  'm_legal_pages',
  'm_vault_sentinel',
  'm_billing_stripe',
  'o_full_export',
  'o_drill_emergency',
  'o_access_review',
  'o_external_audit_walk',
] as const;

export type OperatorChecklistId = (typeof OPERATOR_CHECKLIST_IDS)[number];

export type OperatorChecklistLogKind =
  | 'check'
  | 'uncheck'
  | 'reset_daily'
  | 'reset_weekly'
  | 'reset_monthly'
  | 'archive_snapshot';

export type OperatorChecklistLogEntry = {
  at: string;
  kind: OperatorChecklistLogKind;
  itemId?: string;
  note?: string | null;
  /** e.g. "12/22" for snapshot */
  summary?: string | null;
};

export type OperatorChecklistSnapshot = {
  at: string;
  note: string | null;
  doneCount: number;
  totalSlots: number;
  checkedIds: OperatorChecklistId[];
};

export type OperatorChecklistStored = {
  checked: Partial<Record<OperatorChecklistId, boolean>>;
  updatedAt: string | null;
  log: OperatorChecklistLogEntry[];
  snapshots: OperatorChecklistSnapshot[];
};

export const ID_SET = new Set<string>(OPERATOR_CHECKLIST_IDS);

function normalizeChecked(raw: unknown): Partial<Record<OperatorChecklistId, boolean>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<OperatorChecklistId, boolean>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ID_SET.has(k)) continue;
    if (v === true) out[k as OperatorChecklistId] = true;
  }
  return out;
}

function normalizeLog(raw: unknown): OperatorChecklistLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const kinds: OperatorChecklistLogKind[] = [
    'check',
    'uncheck',
    'reset_daily',
    'reset_weekly',
    'reset_monthly',
    'archive_snapshot',
  ];
  const kindSet = new Set(kinds);
  const out: OperatorChecklistLogEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const at = typeof o.at === 'string' ? o.at : '';
    const kind = o.kind as OperatorChecklistLogKind;
    if (!at || !kindSet.has(kind)) continue;
    const itemId =
      typeof o.itemId === 'string' && ID_SET.has(o.itemId) ? (o.itemId as OperatorChecklistId) : undefined;
    const note = o.note === null || typeof o.note === 'string' ? (o.note as string | null) : undefined;
    const summary = o.summary === null || typeof o.summary === 'string' ? (o.summary as string | null) : undefined;
    out.push({
      at,
      kind,
      ...(itemId ? { itemId } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(summary !== undefined ? { summary } : {}),
    });
  }
  return out.slice(-MAX_LOG_ENTRIES);
}

function normalizeSnapshots(raw: unknown): OperatorChecklistSnapshot[] {
  if (!Array.isArray(raw)) return [];
  const out: OperatorChecklistSnapshot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const at = typeof o.at === 'string' ? o.at : '';
    if (!at) continue;
    const note = o.note === null ? null : typeof o.note === 'string' ? o.note : null;
    const doneCount = typeof o.doneCount === 'number' && Number.isFinite(o.doneCount) ? Math.max(0, o.doneCount) : 0;
    const totalSlots =
      typeof o.totalSlots === 'number' && Number.isFinite(o.totalSlots)
        ? Math.max(0, o.totalSlots)
        : OPERATOR_CHECKLIST_IDS.length;
    const rawIds = Array.isArray(o.checkedIds) ? o.checkedIds : [];
    const checkedIds = rawIds.filter((id): id is OperatorChecklistId => ID_SET.has(String(id)));
    out.push({ at, note, doneCount, totalSlots, checkedIds });
  }
  return out.slice(-MAX_SNAPSHOTS);
}

export function normalizeOperatorChecklist(raw: unknown): OperatorChecklistStored {
  if (!raw || typeof raw !== 'object') {
    return { checked: {}, updatedAt: null, log: [], snapshots: [] };
  }
  const o = raw as Record<string, unknown>;
  return {
    checked: normalizeChecked(o.checked),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
    log: normalizeLog(o.log),
    snapshots: normalizeSnapshots(o.snapshots),
  };
}

export function buildSnapshot(state: OperatorChecklistStored, note?: string | null): OperatorChecklistSnapshot {
  const checkedIds = OPERATOR_CHECKLIST_IDS.filter((id) => state.checked[id] === true);
  return {
    at: new Date().toISOString(),
    note: note?.trim() ? note.trim().slice(0, 2000) : null,
    doneCount: checkedIds.length,
    totalSlots: OPERATOR_CHECKLIST_IDS.length,
    checkedIds,
  };
}

export function appendLog(
  state: OperatorChecklistStored,
  entries: OperatorChecklistLogEntry[]
): OperatorChecklistStored {
  if (!entries.length) return state;
  const log = [...state.log, ...entries].slice(-MAX_LOG_ENTRIES);
  return { ...state, log };
}

export async function loadOperatorChecklist(admin: SupabaseClient): Promise<OperatorChecklistStored> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', ADMIN_OPERATOR_CHECKLIST_KEY)
    .maybeSingle();
  return normalizeOperatorChecklist(data?.value);
}

export async function saveOperatorChecklist(
  admin: SupabaseClient,
  next: OperatorChecklistStored
): Promise<void> {
  const checked = normalizeChecked(next.checked);
  await admin.from('legal_config').upsert({
    key: ADMIN_OPERATOR_CHECKLIST_KEY,
    value: {
      checked,
      updatedAt: next.updatedAt ?? new Date().toISOString(),
      log: next.log.slice(-MAX_LOG_ENTRIES),
      snapshots: next.snapshots.slice(-MAX_SNAPSHOTS),
    },
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

export function mergeOperatorChecklistPatch(
  prev: OperatorChecklistStored,
  patch: Partial<Record<OperatorChecklistId, boolean>>
): OperatorChecklistStored {
  const checked = { ...normalizeChecked(prev.checked) };
  for (const [k, v] of Object.entries(patch)) {
    if (!ID_SET.has(k)) continue;
    if (v === true) checked[k as OperatorChecklistId] = true;
    else delete checked[k as OperatorChecklistId];
  }
  return {
    ...prev,
    checked,
    updatedAt: new Date().toISOString(),
  };
}

export function resetOperatorChecklistPeriod(
  prev: OperatorChecklistStored,
  period: 'daily' | 'weekly' | 'monthly'
): OperatorChecklistStored {
  const prefix = period === 'daily' ? 'd_' : period === 'weekly' ? 'w_' : 'm_';
  const checked = { ...normalizeChecked(prev.checked) };
  for (const id of OPERATOR_CHECKLIST_IDS) {
    if (id.startsWith(prefix)) delete checked[id];
  }
  return {
    ...prev,
    checked,
    updatedAt: new Date().toISOString(),
  };
}
