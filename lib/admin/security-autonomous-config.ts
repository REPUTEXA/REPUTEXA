import type { SupabaseClient } from '@supabase/supabase-js';

export const SECURITY_AUTONOMOUS_CONFIG_KEY = 'security_autonomous';

export type SecurityAutonomousSchedule = 'off' | 'hourly' | 'daily_random' | 'intensive_15m';

export type SecurityAutonomousStored = {
  schedule: SecurityAutonomousSchedule;
  /**
   * Quand le calendrier auto est actif : fusionner des motifs de bouclier (query URL) après chaque passage.
   * Sans modifier les fichiers du repo — voir middleware + `ghost_shield_runtime`.
   */
  autoShield: boolean;
  /** UTC ISO — dernière exécution réussie du cron Ghost Protocol (ex. security-random-audit) */
  lastRandomAuditAt: string | null;
  /**
   * Créneau quotidien aléatoire (minutes depuis minuit UTC), défini quand l’admin choisit daily_random.
   * Un cron toutes les 15 minutes déclenche le run après ce créneau (UTC).
   */
  dailyRandomSlotMinutesUtc: number | null;
  /** YYYY-MM-DD UTC du dernier run daily_random */
  lastDailyRandomDateUtc: string | null;
};

const DEFAULTS: SecurityAutonomousStored = {
  schedule: 'off',
  autoShield: true,
  lastRandomAuditAt: null,
  dailyRandomSlotMinutesUtc: null,
  lastDailyRandomDateUtc: null,
};

export function normalizeAutonomous(raw: unknown): SecurityAutonomousStored {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  const sched = o.schedule;
  const schedule: SecurityAutonomousSchedule =
    sched === 'hourly' || sched === 'daily_random' || sched === 'intensive_15m' ? sched : 'off';
  const slot = o.dailyRandomSlotMinutesUtc;
  const autoShield = o.autoShield === false ? false : true;
  return {
    schedule,
    autoShield,
    lastRandomAuditAt: typeof o.lastRandomAuditAt === 'string' ? o.lastRandomAuditAt : null,
    dailyRandomSlotMinutesUtc:
      typeof slot === 'number' && Number.isFinite(slot) && slot >= 0 && slot < 1440
        ? Math.floor(slot)
        : null,
    lastDailyRandomDateUtc:
      typeof o.lastDailyRandomDateUtc === 'string' ? o.lastDailyRandomDateUtc : null,
  };
}

export async function loadSecurityAutonomousConfig(
  admin: SupabaseClient
): Promise<SecurityAutonomousStored> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', SECURITY_AUTONOMOUS_CONFIG_KEY)
    .maybeSingle();
  return normalizeAutonomous(data?.value);
}

export async function saveSecurityAutonomousConfig(
  admin: SupabaseClient,
  next: SecurityAutonomousStored
): Promise<void> {
  let dailyRandomSlotMinutesUtc = next.dailyRandomSlotMinutesUtc;
  if (next.schedule === 'daily_random' && dailyRandomSlotMinutesUtc == null) {
    dailyRandomSlotMinutesUtc = Math.floor(Math.random() * 1440);
  }
  await admin.from('legal_config').upsert({
    key: SECURITY_AUTONOMOUS_CONFIG_KEY,
    value: {
      ...next,
      dailyRandomSlotMinutesUtc,
    },
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function minutesSinceMidnightUtc(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Après un run cron réussi — met à jour l’horodatage et re-tire un créneau quotidien aléatoire. */
export async function saveSecurityAutonomousAfterRun(
  admin: SupabaseClient,
  prev: SecurityAutonomousStored,
  scannedAtIso: string
): Promise<void> {
  const next: SecurityAutonomousStored = {
    ...prev,
    lastRandomAuditAt: scannedAtIso,
  };
  if (prev.schedule === 'daily_random') {
    next.lastDailyRandomDateUtc = utcYmd(new Date());
    next.dailyRandomSlotMinutesUtc = Math.floor(Math.random() * 1440);
  }
  await admin.from('legal_config').upsert({
    key: SECURITY_AUTONOMOUS_CONFIG_KEY,
    value: next,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

/**
 * Planification pour un cron déclenché toutes les 15 minutes (Vercel).
 */
export function shouldRunSecurityAutonomousCron(
  config: SecurityAutonomousStored,
  now: Date = new Date()
): boolean {
  if (config.schedule === 'off') return false;

  const last = config.lastRandomAuditAt ? new Date(config.lastRandomAuditAt).getTime() : 0;
  const nowMs = now.getTime();

  if (config.schedule === 'intensive_15m') {
    return nowMs - last >= 14 * 60 * 1000;
  }
  if (config.schedule === 'hourly') {
    return nowMs - last >= 59 * 60 * 1000;
  }
  if (config.schedule === 'daily_random') {
    const today = utcYmd(now);
    if (config.lastDailyRandomDateUtc === today) return false;
    const slot = config.dailyRandomSlotMinutesUtc ?? 0;
    const mins = minutesSinceMidnightUtc(now);
    /* Premier passage du cron après le créneau tiré (UTC), une fois par jour. */
    return mins >= slot;
  }

  return false;
}
