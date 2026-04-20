import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { IA_FORGE_AGENT_KEYS, type IaForgeAgentKey, type IaForgeTrainingMode } from '@/lib/admin/ia-forge-constants';

export type { IaForgeAgentKey, IaForgeTrainingMode };
export { IA_FORGE_AGENT_KEYS };
export { IA_FORGE_LABELS } from '@/lib/admin/ia-forge-constants';

export type IaForgeLiveScores = {
  accuracyPct: number | null;
  conversionPct: number | null;
  repairAvgMinutes: number | null;
  relevancePct: number | null;
};

function normalizeReply(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[«»"""']/g, '"')
    .toLowerCase();
}

/** % d'avis publiés où la réponse finale = proposition IA (sans retouche majeure). */
export async function computeReputexaAccuracyPct(admin: SupabaseClient): Promise<number | null> {
  const { data, error } = await admin
    .from('reviews')
    .select('ai_response, response_text')
    .eq('status', 'published')
    .not('ai_response', 'is', null)
    .not('response_text', 'is', null)
    .limit(4000);

  if (error) {
    console.warn('[ia-forge] reputexa accuracy', error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;

  let match = 0;
  for (const r of rows) {
    const ai = normalizeReply(r.ai_response as string);
    const pub = normalizeReply(r.response_text as string);
    if (!ai || !pub) continue;
    if (pub === ai || pub.startsWith(ai.slice(0, Math.min(40, ai.length)))) match += 1;
    else if (pub.length > 20 && ai.length > 20) {
      const overlap = longestCommonSubstringLength(pub, ai);
      if (overlap / Math.max(pub.length, ai.length) > 0.88) match += 1;
    }
  }
  return Math.round((match / rows.length) * 1000) / 10;
}

function longestCommonSubstringLength(a: string, b: string): number {
  let best = 0;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (!short.length) return 0;
  for (let len = short.length; len > best; len--) {
    for (let i = 0; i + len <= short.length; i++) {
      const slice = short.slice(i, i + len);
      if (long.includes(slice)) {
        best = len;
        break;
      }
    }
  }
  return best;
}

/** Prospection Prisma : % de fiches ayant quitté l'état « à contacter ». */
export async function computeBabelConversionPct(): Promise<number | null> {
  try {
    const total = await prisma.prospect.count();
    if (total === 0) return null;
    const outreached = await prisma.prospect.count({
      where: { NOT: { status: 'TO_CONTACT' } },
    });
    return Math.round((outreached / total) * 1000) / 10;
  } catch (e) {
    console.warn('[ia-forge] babel conversion', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Confiance diagnostic Nexus (30 j). */
export async function computeNexusRelevancePct(admin: SupabaseClient): Promise<number | null> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await admin
    .from('support_audit_log')
    .select('confidence_score')
    .gte('created_at', since.toISOString())
    .not('confidence_score', 'is', null)
    .limit(2000);

  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code !== '42P01') console.warn('[ia-forge] nexus relevance', error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => acc + Number(r.confidence_score), 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

/** Temps moyen (minutes) avant résolution d'un item dev_backlog « resolved » (90 j). */
export async function computeSentinelRepairMinutes(admin: SupabaseClient): Promise<number | null> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data, error } = await admin
    .from('dev_backlog')
    .select('created_at, updated_at')
    .eq('status', 'resolved')
    .gte('created_at', since.toISOString())
    .limit(500);

  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code !== '42P01') console.warn('[ia-forge] sentinel repair', error.message);
    return null;
  }
  const rows = data ?? [];
  if (rows.length === 0) return null;
  let totalMin = 0;
  for (const r of rows) {
    const c = new Date(String(r.created_at)).getTime();
    const u = new Date(String(r.updated_at)).getTime();
    if (Number.isFinite(c) && Number.isFinite(u) && u >= c) {
      totalMin += (u - c) / 60000;
    }
  }
  return Math.round((totalMin / rows.length) * 10) / 10;
}

/** Score synthétique Guardian (moins de brouillons pending = mieux). */
export async function computeGuardianRelevancePct(admin: SupabaseClient): Promise<number | null> {
  const { count: pending, error: e1 } = await admin
    .from('legal_guardian_drafts')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'pending_admin');

  if (e1) {
    console.warn('[ia-forge] guardian', e1.message);
    return null;
  }
  const p = pending ?? 0;
  const penalty = Math.min(45, p * 3);
  return Math.max(55, Math.round((100 - penalty) * 10) / 10);
}

export async function computeLiveScoresForAgents(
  admin: SupabaseClient
): Promise<Record<IaForgeAgentKey, IaForgeLiveScores>> {
  const [acc, babelConv, nexusRel, sentinelMin, guardianRel] = await Promise.all([
    computeReputexaAccuracyPct(admin),
    computeBabelConversionPct(),
    computeNexusRelevancePct(admin),
    computeSentinelRepairMinutes(admin),
    computeGuardianRelevancePct(admin),
  ]);

  const geniusCore =
    acc != null && nexusRel != null ? Math.round(((acc + nexusRel) / 2) * 10) / 10 : acc ?? nexusRel ?? null;

  return {
    reputexa_core: {
      accuracyPct: acc,
      conversionPct: null,
      repairAvgMinutes: null,
      relevancePct: geniusCore,
    },
    babel: {
      accuracyPct: null,
      conversionPct: babelConv,
      repairAvgMinutes: null,
      relevancePct: babelConv,
    },
    nexus: {
      accuracyPct: null,
      conversionPct: null,
      repairAvgMinutes: null,
      relevancePct: nexusRel,
    },
    sentinel: {
      accuracyPct: null,
      conversionPct: null,
      repairAvgMinutes: sentinelMin,
      relevancePct:
        sentinelMin != null ? Math.max(0, Math.min(100, Math.round(100 - Math.min(sentinelMin / 60, 80)))) : null,
    },
    guardian: {
      accuracyPct: null,
      conversionPct: null,
      repairAvgMinutes: null,
      relevancePct: guardianRel,
    },
  };
}

export type DailyMetricRow = {
  day: string;
  agent_key: string;
  accuracy_pct: number | null;
  conversion_pct: number | null;
  repair_avg_minutes: number | null;
  relevance_pct: number | null;
};

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertTodayMetricSnapshots(
  admin: SupabaseClient,
  live: Record<IaForgeAgentKey, IaForgeLiveScores>
): Promise<void> {
  const day = todayUtcDate();
  for (const key of IA_FORGE_AGENT_KEYS) {
    const s = live[key];
    const row = {
      day,
      agent_key: key,
      accuracy_pct: s.accuracyPct,
      conversion_pct: s.conversionPct,
      repair_avg_minutes: s.repairAvgMinutes,
      relevance_pct: s.relevancePct,
    };
    const { error } = await admin.from('ia_forge_metric_daily').upsert(row, {
      onConflict: 'day,agent_key',
    });
    if (error) throw new Error(error.message);
  }
}

export async function loadAgentTrainingModes(
  admin: SupabaseClient
): Promise<Record<IaForgeAgentKey, IaForgeTrainingMode>> {
  const { data, error } = await admin.from('ia_forge_agent_state').select('agent_key, training_mode');
  if (error) throw new Error(error.message);
  const modes = { ...defaultModes() };
  for (const r of data ?? []) {
    const k = r.agent_key as IaForgeAgentKey;
    if (IA_FORGE_AGENT_KEYS.includes(k) && r.training_mode) {
      modes[k] = r.training_mode as IaForgeTrainingMode;
    }
  }
  return modes;
}

function defaultModes(): Record<IaForgeAgentKey, IaForgeTrainingMode> {
  return {
    reputexa_core: 'continuous',
    babel: 'continuous',
    nexus: 'continuous',
    sentinel: 'burst',
    guardian: 'burst',
  };
}

export async function setAgentTrainingMode(
  admin: SupabaseClient,
  agentKey: IaForgeAgentKey,
  mode: IaForgeTrainingMode
): Promise<void> {
  const { error } = await admin.from('ia_forge_agent_state').upsert(
    { agent_key: agentKey, training_mode: mode, updated_at: new Date().toISOString() },
    { onConflict: 'agent_key' }
  );
  if (error) throw new Error(error.message);
}

export async function loadMetricHistory(
  admin: SupabaseClient,
  days: number
): Promise<DailyMetricRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data, error } = await admin
    .from('ia_forge_metric_daily')
    .select('day, agent_key, accuracy_pct, conversion_pct, repair_avg_minutes, relevance_pct')
    .gte('day', sinceStr)
    .order('day', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyMetricRow[];
}
