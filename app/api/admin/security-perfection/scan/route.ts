import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSecurityPerfectionAudit } from '@/lib/admin/security-perfection-audit';
import {
  appendActivity,
  loadSecurityPerfectionState,
  saveSecurityPerfectionState,
  type SecurityActivityEntry,
} from '@/lib/admin/security-perfection-state';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  let state = await loadSecurityPerfectionState(admin);
  if (state.killSwitch) {
    return NextResponse.json(
      {
        skipped: true,
        reason: 'kill_switch',
        message: ta('securityPerfectionScanSkippedMessage'),
        state,
      },
      { status: 200 }
    );
  }

  try {
    const audit = await runSecurityPerfectionAudit();
    const entries: SecurityActivityEntry[] = [
      {
        at: audit.scannedAt,
        kind: 'scan',
        message: ta('securityPerfectionOffensiveScanDone', { score: audit.healthScore }),
      },
      ...audit.syntheticJournal.map((j) => ({
        at: audit.scannedAt,
        kind: j.kind === 'peer' ? ('peer' as const) : ('simulation' as const),
        message: j.message,
      })),
    ];

    if (state.godMode) {
      entries.push({
        at: new Date().toISOString(),
        kind: 'god' as const,
        message: ta('securityPerfectionGodModeV1Journal'),
      });
    }

    state = {
      ...appendActivity(state, entries),
      healthScore: audit.healthScore,
      lastScanAt: audit.scannedAt,
    };
    await saveSecurityPerfectionState(admin, state);

    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: ta('securityPerfectionComplianceLogLine', { score: audit.healthScore }),
      metadata: {
        kind: 'security_perfection_scan',
        score: audit.healthScore,
        findingIds: audit.findings.map((f) => f.id),
        peerTip: audit.peerTip.slice(0, 500),
      },
      legal_version: null,
    });

    return NextResponse.json({ audit, state });
  } catch (e) {
    console.error('[security-perfection/scan]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('codeGuardianScanFailed') },
      { status: 500 }
    );
  }
}
