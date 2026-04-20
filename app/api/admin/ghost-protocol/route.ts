import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  applyGhostHealthDelta,
  executeStrategicScan,
  loadGhostQueueState,
  type GhostPillarId,
} from '@/lib/admin/ghost-protocol-audit';
import {
  appendActivity,
  loadSecurityPerfectionState,
  saveSecurityPerfectionState,
} from '@/lib/admin/security-perfection-state';
import { loadSecurityAutonomousConfig } from '@/lib/admin/security-autonomous-config';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PILLAR_IDS: GhostPillarId[] = [
  'dast_api_hunger',
  'dast_form_poisoning',
  'sast_logic_audit',
  'sca_supply_chain',
  'auth_session',
  'env_leak_hunter',
  'pay_stripe_integrity',
  'header_security',
  'ai_prompt_injection',
  'perf_database_stress',
];

function isGhostPillar(s: unknown): s is GhostPillarId {
  return typeof s === 'string' && PILLAR_IDS.includes(s as GhostPillarId);
}

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
    return { error: NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 }) };
  }
  return { admin };
}

export async function GET() {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const queue = await loadGhostQueueState(r.admin);
  return NextResponse.json({ queue });
}

export async function POST(req: Request) {
  const r = await requireAdmin();
  if ('error' in r) return r.error;
  const ta = apiAdminT();

  let body: { forcePillar?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const forcePillar = isGhostPillar(body.forcePillar) ? body.forcePillar : undefined;

  const perf = await loadSecurityPerfectionState(r.admin);
  if (perf.killSwitch) {
    return NextResponse.json(
      { skipped: true, reason: 'kill_switch', message: ta('ghostProtocolKillSwitchActive') },
      { status: 200 }
    );
  }

  const godMode = perf.godMode && !perf.killSwitch;
  const auto = await loadSecurityAutonomousConfig(r.admin);
  const persistAutoShield = auto.autoShield !== false;
  try {
    const result = await executeStrategicScan(r.admin, {
      godMode,
      forcePillar,
      persistAutoShield,
    });
    let state = await loadSecurityPerfectionState(r.admin);
    const { nextScore } = applyGhostHealthDelta(state.healthScore, result.findings);
    const message = ta('ghostProtocolActivityLog', {
      layer: result.layer,
      pillarLabel: result.pillarLabel,
      findingCount: result.findings.length,
      nextScore,
      nextPillarPreview: result.nextPillarPreview,
    });
    state = {
      ...appendActivity(state, [{ at: result.scannedAt, kind: 'ghost', message }]),
      healthScore: nextScore,
      lastScanAt: result.scannedAt,
    };
    await saveSecurityPerfectionState(r.admin, state);

    return NextResponse.json({ ok: true, result, state });
  } catch (e) {
    console.error('[admin/ghost-protocol]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('ghostProtocolExecutionFailed') },
      { status: 500 }
    );
  }
}
