import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeLiveScoresForAgents,
  IA_FORGE_AGENT_KEYS,
  loadAgentTrainingModes,
  loadMetricHistory,
  setAgentTrainingMode,
  upsertTodayMetricSnapshots,
  type IaForgeAgentKey,
  type IaForgeTrainingMode,
} from '@/lib/admin/ia-forge';
import { IA_FORGE_LABELS } from '@/lib/admin/ia-forge-constants';
import { applyBabelTemplateEvolutionFromMetrics } from '@/lib/admin/babel-forge-mutator';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 }) };
  }
  return { admin, user } as const;
}

/**
 * GET — agrégat Forge : scores live, modes, historique, RLHF, snippets, cross-learning.
 */
export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;
  const ta = apiAdminT();

  try {
    const [live, modes, historyRows] = await Promise.all([
      computeLiveScoresForAgents(admin),
      loadAgentTrainingModes(admin),
      loadMetricHistory(admin, 45),
    ]);

    const [{ data: rlhf }, { data: snippets }, { data: cross }, { data: ctxRow }] = await Promise.all([
      admin
        .from('ia_forge_rlhf_queue')
        .select('id, agent_key, title, context_text, ai_draft, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(30),
      admin.from('ia_forge_snippet').select('id, agent_key, body, source, created_at').limit(40),
      admin.from('ia_forge_cross_learn').select('id, source_agent, target_agent, pattern, notes, created_at').limit(35),
      admin
        .from('ia_forge_context_store')
        .select('content')
        .eq('key', 'forge_last_analysis_summary')
        .maybeSingle(),
    ]);

    const historyByAgent: Record<string, { day: string; relevance_pct: number | null }[]> = {};
    for (const k of IA_FORGE_AGENT_KEYS) {
      historyByAgent[k] = [];
    }
    for (const row of historyRows) {
      const k = row.agent_key;
      if (!historyByAgent[k]) historyByAgent[k] = [];
      historyByAgent[k].push({
        day: String(row.day),
        relevance_pct: row.relevance_pct != null ? Number(row.relevance_pct) : null,
      });
    }

    const agents = IA_FORGE_AGENT_KEYS.map((key) => ({
      key,
      label: IA_FORGE_LABELS[key],
      trainingMode: modes[key],
      scores: live[key],
      history: historyByAgent[key] ?? [],
    }));

    return NextResponse.json({
      agents,
      forgeSummary: ctxRow?.content ?? null,
      rlhfPending: rlhf ?? [],
      snippets: snippets ?? [],
      crossLearn: cross ?? [],
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[admin/ia-forge GET]', e);
    const msg = e instanceof Error ? e.message : ta('forgeErrorGeneric');
    const hint =
      msg.includes('ia_forge') || msg.includes('does not exist') ? ta('forgeMigrationHint') : undefined;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}

/**
 * PATCH — mode d'entraînement : { agentKey, trainingMode }
 */
export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;
  const ta = apiAdminT();

  const raw = await request.json().catch(() => ({}));
  const agentKey = raw.agentKey as string | undefined;
  const trainingMode = raw.trainingMode as string | undefined;

  const validModes = new Set<IaForgeTrainingMode>(['continuous', 'burst', 'deep_dive']);
  if (!agentKey || !IA_FORGE_AGENT_KEYS.includes(agentKey as IaForgeAgentKey)) {
    return NextResponse.json({ error: ta('forgeAgentKeyInvalid') }, { status: 400 });
  }
  if (!trainingMode || !validModes.has(trainingMode as IaForgeTrainingMode)) {
    return NextResponse.json({ error: ta('forgeTrainingModeInvalid') }, { status: 400 });
  }

  try {
    await setAgentTrainingMode(admin, agentKey as IaForgeAgentKey, trainingMode as IaForgeTrainingMode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/ia-forge PATCH]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('forgeUpdateFailed') },
      { status: 500 }
    );
  }
}

/**
 * POST — { action: 'snapshot' } enregistre les métriques du jour (sans analyse GPT).
 */
export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;
  const ta = apiAdminT();

  const raw = await request.json().catch(() => ({}));
  if (raw.action !== 'snapshot') {
    return NextResponse.json({ error: ta('forgeSnapshotActionRequired') }, { status: 400 });
  }

  try {
    const live = await computeLiveScoresForAgents(admin);
    await upsertTodayMetricSnapshots(admin, live);
    const babelAutopilotUpdated = await applyBabelTemplateEvolutionFromMetrics(admin);
    return NextResponse.json({
      ok: true,
      day: new Date().toISOString().slice(0, 10),
      babelAutopilotUpdated,
    });
  } catch (e) {
    console.error('[admin/ia-forge POST snapshot]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('forgeSnapshotFailed') },
      { status: 500 }
    );
  }
}
