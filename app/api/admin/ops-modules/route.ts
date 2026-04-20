/**
 * GET /api/admin/ops-modules — green / amber / red status per admin module (client polls ~30s).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadSecurityPerfectionState } from '@/lib/admin/security-perfection-state';
import { loadCodeGuardianState } from '@/lib/admin/code-guardian-state';
import { getBlackBoxS3Config } from '@/lib/black-box/s3-io';
import { computeAdminIntegrationsOverall } from '@/lib/admin/health-check-internal';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

export type OpsModuleKey =
  | 'security'
  | 'compliance'
  | 'auditKit'
  | 'blackBox'
  | 'iaForge'
  | 'nexus'
  | 'codeGuardian'
  | 'sentinel'
  | 'legalPublish';

type Mod = 'ok' | 'degraded' | 'critical';

export async function GET() {
  const ta = apiAdminT();
  const th = createServerTranslator('OpsModuleHints');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

  const [integrationsOverall, secState, cgState, guardianRow, draftCount, vaultRow, bbRun, nexusCrit, nexusWarn] =
    await Promise.all([
      computeAdminIntegrationsOverall().catch(() => 'critical' as Mod),
      loadSecurityPerfectionState(admin),
      loadCodeGuardianState(admin),
      admin.from('legal_guardian_state').select('last_status').eq('id', 1).maybeSingle(),
      admin
        .from('legal_guardian_drafts')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'pending_admin'),
      admin
        .from('sentinel_vault_runs')
        .select('status')
        .order('run_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('black_box_archive_runs')
        .select('status')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('tickets')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'open')
        .gte('gravity_score', 70),
      admin
        .from('tickets')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'open')
        .gte('gravity_score', 40)
        .lt('gravity_score', 70),
    ]);

  const pendingDrafts = draftCount.count ?? 0;
  const gs = String(guardianRow.data?.last_status ?? '').toLowerCase();

  let security: Mod = 'ok';
  if (secState.killSwitch) security = 'critical';
  else if (secState.healthScore < 55) security = 'critical';
  else if (secState.healthScore < 75) security = 'degraded';

  let compliance: Mod = 'ok';
  if (gs.includes('fail') || gs.includes('error')) compliance = 'critical';
  else if (pendingDrafts > 0) compliance = 'degraded';

  const auditKit = compliance;

  let blackBox: Mod = 'ok';
  if (!getBlackBoxS3Config()) blackBox = 'critical';
  else if (bbRun.data?.status === 'failed') blackBox = 'critical';
  else if (!bbRun.data) blackBox = 'degraded';

  let iaForge: Mod = 'ok';
  if (!process.env.OPENAI_API_KEY?.trim()) iaForge = 'critical';

  let nexus: Mod = 'ok';
  if ((nexusCrit.count ?? 0) > 0) nexus = 'critical';
  else if ((nexusWarn.count ?? 0) > 0) nexus = 'degraded';

  let codeGuardian: Mod = 'ok';
  if (cgState.technicalDebtScore < 45) codeGuardian = 'critical';
  else if (cgState.technicalDebtScore < 65) codeGuardian = 'degraded';

  const sentinel = integrationsOverall;

  let legalPublish: Mod = 'ok';
  if (pendingDrafts > 0) legalPublish = 'degraded';

  const modules: Record<OpsModuleKey, Mod> = {
    security,
    compliance,
    auditKit,
    blackBox,
    iaForge,
    nexus,
    codeGuardian,
    sentinel,
    legalPublish,
  };

  const bbLast = bbRun.data?.status ?? null;
  const moduleHints: Record<OpsModuleKey, string> = {
    security: secState.killSwitch
      ? th('securityEmergency')
      : th('securityFortress', { score: secState.healthScore }),
    compliance:
      gs.includes('fail') || gs.includes('error')
        ? th('complianceGuardianError')
        : pendingDrafts > 0
          ? th('complianceDraftsPending', { count: pendingDrafts })
          : th('complianceSyncQueue'),
    auditKit:
      pendingDrafts > 0 || gs.includes('fail') || gs.includes('error')
        ? th('auditKitCheckCompliance')
        : th('auditKitReadmeReady'),
    blackBox: !getBlackBoxS3Config()
      ? th('blackBoxS3Missing')
      : bbLast === 'failed'
        ? th('blackBoxLastFailed')
        : bbLast == null
          ? th('blackBoxNoRunYet')
          : th('blackBoxLastRun', { status: String(bbLast) }),
    iaForge: !process.env.OPENAI_API_KEY?.trim() ? th('iaForgeNoOpenai') : th('iaForgeOk'),
    nexus:
      (nexusCrit.count ?? 0) > 0
        ? th('nexusCriticalOpen', { count: nexusCrit.count ?? 0 })
        : (nexusWarn.count ?? 0) > 0
          ? th('nexusMediumGravity', { count: nexusWarn.count ?? 0 })
          : th('nexusNoUrgency'),
    codeGuardian: th('codeGuardianDebt', { score: cgState.technicalDebtScore }),
    sentinel:
      integrationsOverall === 'critical'
        ? th('sentinelIntegrationCritical')
        : integrationsOverall === 'degraded'
          ? th('sentinelIntegrationDegraded')
          : th('sentinelIntegrationsOk'),
    legalPublish:
      pendingDrafts > 0
        ? th('legalPublishTextsPending', { count: pendingDrafts })
        : th('legalPublishNothingPending'),
  };

  const telemetry = {
    securityHealth: secState.healthScore,
    killSwitch: secState.killSwitch,
    codeGuardianScore: cgState.technicalDebtScore,
    nexusOpenCritical: nexusCrit.count ?? 0,
    nexusOpenWarnBand: nexusWarn.count ?? 0,
    pendingLegalDrafts: pendingDrafts,
    blackBoxLastStatus: bbLast,
    sentinelVaultLastStatus: vaultRow.data?.status ?? null,
    integrationsOverall,
    guardianStatusLine: guardianRow.data?.last_status ?? null,
  };

  return NextResponse.json({
    modules,
    moduleHints,
    telemetry,
    checked_at: new Date().toISOString(),
  });
}
