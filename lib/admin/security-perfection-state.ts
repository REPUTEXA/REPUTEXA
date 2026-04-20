import type { SupabaseClient } from '@supabase/supabase-js';

export const SECURITY_PERFECTION_CONFIG_KEY = 'security_perfection';

export type SecurityActivityKind =
  | 'scan'
  | 'simulation'
  | 'peer'
  | 'god'
  | 'kill'
  | 'patch'
  | 'ghost'
  | 'vault_ok'
  | 'vault_fail';

export type SecurityActivityEntry = {
  at: string;
  kind: SecurityActivityKind;
  message: string;
};

export type SecurityPerfectionStored = {
  godMode: boolean;
  killSwitch: boolean;
  healthScore: number;
  lastScanAt?: string | null;
  activity: SecurityActivityEntry[];
};

const DEFAULTS: SecurityPerfectionStored = {
  godMode: false,
  killSwitch: false,
  healthScore: 100,
  activity: [],
};

const MAX_ACTIVITY = 60;

function normalizeStored(raw: unknown): SecurityPerfectionStored {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  return {
    godMode: o.godMode === true,
    killSwitch: o.killSwitch === true,
    healthScore:
      typeof o.healthScore === 'number' && Number.isFinite(o.healthScore)
        ? Math.max(0, Math.min(100, Math.round(o.healthScore)))
        : DEFAULTS.healthScore,
    lastScanAt: typeof o.lastScanAt === 'string' ? o.lastScanAt : null,
    activity: Array.isArray(o.activity)
      ? (o.activity as SecurityActivityEntry[])
          .filter((a) => a && typeof a.at === 'string' && typeof a.message === 'string')
          .slice(-MAX_ACTIVITY)
      : [],
  };
}

export async function loadSecurityPerfectionState(
  admin: SupabaseClient
): Promise<SecurityPerfectionStored> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', SECURITY_PERFECTION_CONFIG_KEY)
    .maybeSingle();
  return normalizeStored(data?.value);
}

export async function saveSecurityPerfectionState(
  admin: SupabaseClient,
  next: SecurityPerfectionStored
): Promise<void> {
  const activity = next.activity.slice(-MAX_ACTIVITY);
  await admin.from('legal_config').upsert({
    key: SECURITY_PERFECTION_CONFIG_KEY,
    value: {
      ...next,
      activity,
    },
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

export function appendActivity(
  state: SecurityPerfectionStored,
  entries: SecurityActivityEntry[]
): SecurityPerfectionStored {
  return {
    ...state,
    activity: [...state.activity, ...entries].slice(-MAX_ACTIVITY),
  };
}

export function patchSecurityPerfectionState(
  state: SecurityPerfectionStored,
  patch: Partial<Pick<SecurityPerfectionStored, 'godMode' | 'killSwitch'>>
): SecurityPerfectionStored {
  const killSwitch = patch.killSwitch !== undefined ? patch.killSwitch : state.killSwitch;
  let godMode = patch.godMode !== undefined ? patch.godMode : state.godMode;
  if (killSwitch) godMode = false;
  return { ...state, godMode, killSwitch };
}
