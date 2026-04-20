import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runCodeGuardianScan, buildCleanlistExport } from '@/lib/admin/code-guardian-audit';
import {
  appendIndigoJournal,
  loadCodeGuardianState,
  saveCodeGuardianState,
} from '@/lib/admin/code-guardian-state';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function POST() {
  const r = await requireAdmin();
  if ('error' in r) return r.error;

  const ta = apiAdminT();
  try {
    const audit = runCodeGuardianScan();
    let state = await loadCodeGuardianState(r.admin);
    const journalLine = ta('codeGuardianJournalScanLine', {
      score: audit.technicalDebtScore,
      cleanup: audit.summary.cleanupHints,
      performance: audit.summary.performanceHints,
      structure: audit.summary.structureHints,
    });
    state = {
      ...appendIndigoJournal(state, [{ at: audit.scannedAt, kind: 'scan', message: journalLine }]),
      lastScanAt: audit.scannedAt,
      technicalDebtScore: audit.technicalDebtScore,
      lastFindingIds: audit.findings.map((f) => f.id),
    };
    await saveCodeGuardianState(r.admin, state);

    await r.admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: ta('codeGuardianComplianceLogMessage', { score: audit.technicalDebtScore }),
      metadata: {
        kind: 'code_guardian_scan',
        score: audit.technicalDebtScore,
        summary: audit.summary,
        findingCount: audit.findings.length,
      },
      legal_version: null,
    });

    const exportMarkdown = buildCleanlistExport(audit.findings, audit.scannedAt);

    return NextResponse.json({ audit, state, exportMarkdown });
  } catch (e) {
    console.error('[code-guardian/scan]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('codeGuardianScanFailed') },
      { status: 500 }
    );
  }
}
