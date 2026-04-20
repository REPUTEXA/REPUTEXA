/**
 * Cron hebdomadaire — dimanche soir UTC : snapshots métriques + analyse GPT pour agents en mode « burst ».
 * GET/POST — Authorization: Bearer CRON_SECRET ou x-vercel-cron: 1
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeLiveScoresForAgents,
  loadAgentTrainingModes,
  upsertTodayMetricSnapshots,
} from '@/lib/admin/ia-forge';
import { runIaForgeAnalysis } from '@/lib/admin/ia-forge-analyze';
import { applyBabelTemplateEvolutionFromMetrics } from '@/lib/admin/babel-forge-mutator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')?.trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const bearerOk = !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`);
  return bearerOk || isVercelCron;
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runBody();
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runBody();
}

async function runBody() {
  const ta = apiAdminT();
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  try {
    const live = await computeLiveScoresForAgents(admin);
    await upsertTodayMetricSnapshots(admin, live);

    const modes = await loadAgentTrainingModes(admin);
    const burstAgents = Object.entries(modes).filter(([, m]) => m === 'burst');

    let analysis: { insertedSnippets: number; crossInserted: number } | null = null;
    /** GPT uniquement si au moins un agent est en mode Burst (Deep-Dive reste manuel). */
    if (burstAgents.length > 0 && process.env.OPENAI_API_KEY) {
      analysis = await runIaForgeAnalysis(admin, { depth: 'batch' });
    }

    const babelEvolved = await applyBabelTemplateEvolutionFromMetrics(admin);

    return NextResponse.json({
      ok: true,
      snapshotDay: new Date().toISOString().slice(0, 10),
      burstAgentsConsidered: burstAgents.map(([k]) => k),
      analysis,
      babelAutopilotUpdated: babelEvolved,
    });
  } catch (e) {
    console.error('[cron/ia-forge-batch]', e);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }
}
