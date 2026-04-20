import type { SupabaseClient } from '@supabase/supabase-js';

export const CODE_GUARDIAN_CONFIG_KEY = 'code_guardian_state';

export type CodeGuardianJournalEntry = {
  at: string;
  kind: 'scan' | 'export';
  message: string;
};

export type CodeGuardianStored = {
  lastScanAt: string | null;
  technicalDebtScore: number;
  /** Journal Indigo — rapports de perfectionnement (pas d’écriture auto en disque). */
  indigoJournal: CodeGuardianJournalEntry[];
  /** Résumé du dernier scan (IDs des findings, pas le corps complet). */
  lastFindingIds: string[];
};

const DEFAULTS: CodeGuardianStored = {
  lastScanAt: null,
  technicalDebtScore: 100,
  indigoJournal: [],
  lastFindingIds: [],
};

const MAX_JOURNAL = 48;

function normalize(raw: unknown): CodeGuardianStored {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  const journal = Array.isArray(o.indigoJournal)
    ? (o.indigoJournal as CodeGuardianJournalEntry[])
        .filter((e) => e && typeof e.at === 'string' && typeof e.message === 'string')
        .slice(-MAX_JOURNAL)
    : [];
  return {
    lastScanAt: typeof o.lastScanAt === 'string' ? o.lastScanAt : null,
    technicalDebtScore:
      typeof o.technicalDebtScore === 'number' && Number.isFinite(o.technicalDebtScore)
        ? Math.max(0, Math.min(100, Math.round(o.technicalDebtScore)))
        : DEFAULTS.technicalDebtScore,
    indigoJournal: journal,
    lastFindingIds: Array.isArray(o.lastFindingIds)
      ? (o.lastFindingIds as string[]).filter((id) => typeof id === 'string').slice(0, 200)
      : [],
  };
}

export async function loadCodeGuardianState(admin: SupabaseClient): Promise<CodeGuardianStored> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', CODE_GUARDIAN_CONFIG_KEY)
    .maybeSingle();
  return normalize(data?.value);
}

export async function saveCodeGuardianState(admin: SupabaseClient, next: CodeGuardianStored): Promise<void> {
  await admin.from('legal_config').upsert({
    key: CODE_GUARDIAN_CONFIG_KEY,
    value: {
      ...next,
      indigoJournal: next.indigoJournal.slice(-MAX_JOURNAL),
    },
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

export function appendIndigoJournal(
  state: CodeGuardianStored,
  entries: CodeGuardianJournalEntry[]
): CodeGuardianStored {
  return {
    ...state,
    indigoJournal: [...state.indigoJournal, ...entries].slice(-MAX_JOURNAL),
  };
}
