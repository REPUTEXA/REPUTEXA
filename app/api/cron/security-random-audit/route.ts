/**
 * Cron pentest continu (Ghost Protocol) — une mission / passage, file prioritaire 10 piliers.
 * Planification : legal_config (shouldRunSecurityAutonomousCron). Ancrage historique : URL inchangée.
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadSecurityAutonomousConfig,
  shouldRunSecurityAutonomousCron,
  saveSecurityAutonomousAfterRun,
} from '@/lib/admin/security-autonomous-config';
import {
  appendActivity,
  loadSecurityPerfectionState,
  saveSecurityPerfectionState,
} from '@/lib/admin/security-perfection-state';
import { applyGhostHealthDelta, executeStrategicScan } from '@/lib/admin/ghost-protocol-audit';
import { refreshClientPriorityScores } from '@/lib/admin/refresh-client-priority';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCronBody();
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCronBody();
}

async function runCronBody() {
  const ta = apiAdminT();
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const priorityRefresh = await refreshClientPriorityScores(admin);

  const [auto, perf] = await Promise.all([
    loadSecurityAutonomousConfig(admin),
    loadSecurityPerfectionState(admin),
  ]);

  if (perf.killSwitch) {
    return NextResponse.json({
      skipped: true,
      reason: 'kill_switch',
      priorityRefresh,
    });
  }

  if (!shouldRunSecurityAutonomousCron(auto)) {
    return NextResponse.json({
      skipped: true,
      reason: 'schedule',
      schedule: auto.schedule,
      priorityRefresh,
    });
  }

  const godMode = perf.godMode && !perf.killSwitch;
  const persistAutoShield = auto.autoShield !== false;
  try {
    const result = await executeStrategicScan(admin, { godMode, persistAutoShield });
    await saveSecurityAutonomousAfterRun(admin, auto, result.scannedAt);

    let state = await loadSecurityPerfectionState(admin);
    const { nextScore } = applyGhostHealthDelta(state.healthScore, result.findings);
    const message = `Ghost Protocol [${result.layer}] ${result.pillarLabel} — ${result.findings.length} observation(s), score ${nextScore}/100 — prochain : ${result.nextPillarPreview}`;
    state = {
      ...appendActivity(state, [{ at: result.scannedAt, kind: 'ghost', message }]),
      healthScore: nextScore,
      lastScanAt: result.scannedAt,
    };
    await saveSecurityPerfectionState(admin, state);

    return NextResponse.json({
      ok: true,
      ghost: true,
      priorityRefresh,
      pillar: result.pillar,
      layer: result.layer,
      runId: result.runId,
      findings: result.findings.length,
      interceptionRules: result.interceptionRules.length,
      requestsExecuted: result.requestsExecuted,
      healthScore: nextScore,
      nextPillarPreview: result.nextPillarPreview,
    });
  } catch (e) {
    console.error('[cron/security-random-audit]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'run failed' },
      { status: 500 }
    );
  }
}
