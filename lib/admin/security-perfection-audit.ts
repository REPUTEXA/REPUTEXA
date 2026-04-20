/**
 * “Offensive AI” audits without destructive attacks:
 * - no auth bruteforce,
 * - no load on real accounts,
 * - minimal HTTP probes (malformed / unauthenticated) against the deployed instance.
 */

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { createTranslator } from 'next-intl';

export type OffensiveFindingSeverity = 'ok' | 'info' | 'warning' | 'critical';

export type OffensiveFinding = {
  id: string;
  category: 'injection' | 'bruteforce' | 'api_abuse' | 'ux_perf' | 'env';
  title: string;
  detail: string;
  severity: OffensiveFindingSeverity;
  /** Short line for the activity journal (simulation tone) */
  journalLine?: string;
};

export type SecurityPerfectionAuditResult = {
  scannedAt: string;
  findings: OffensiveFinding[];
  healthScore: number;
  peerTip: string;
  syntheticJournal: { kind: 'simulation' | 'peer'; message: string }[];
};

type SecurityPerfectionAuditTranslator = ReturnType<typeof createTranslator>;

function resolvePublicBaseUrl(): string {
  const candidates = [
    process.env.SENTINEL_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : '',
  ];
  for (const c of candidates) {
    const u = String(c ?? '')
      .trim()
      .replace(/\/$/, '');
    if (u) return u;
  }
  return '';
}

function scoreFromFindings(findings: OffensiveFinding[]): number {
  let s = 100;
  for (const f of findings) {
    if (f.severity === 'critical') s -= 18;
    else if (f.severity === 'warning') s -= 8;
    else if (f.severity === 'info') s -= 3;
  }
  return Math.max(0, Math.min(100, s));
}

async function fetchStatus(
  url: string,
  init: RequestInit
): Promise<{ status: number; ok: boolean }> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    return { status: r.status, ok: r.ok };
  } catch {
    return { status: 0, ok: false };
  }
}

export async function runSecurityPerfectionAudit(): Promise<SecurityPerfectionAuditResult> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin.securityPerfectionAudit' });

  const scannedAt = new Date().toISOString();
  const findings: OffensiveFinding[] = [];
  const base = resolvePublicBaseUrl();

  if (!base) {
    findings.push({
      id: 'no_public_base',
      category: 'env',
      title: t('noPublicBaseTitle'),
      detail: t('noPublicBaseDetail'),
      severity: 'warning',
    });
  } else {
    const adminHealth = await fetchStatus(`${base}/api/admin/health-check`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (adminHealth.status === 401 || adminHealth.status === 403) {
      findings.push({
        id: 'admin_auth_shell',
        category: 'api_abuse',
        title: t('adminAuthShellTitle'),
        detail: t('adminAuthShellDetail'),
        severity: 'ok',
        journalLine: t('adminAuthShellJournal'),
      });
    } else if (adminHealth.ok && adminHealth.status === 200) {
      findings.push({
        id: 'admin_exposed',
        category: 'api_abuse',
        title: t('adminExposedTitle'),
        detail: t('adminExposedDetail'),
        severity: 'critical',
        journalLine: t('adminExposedJournal'),
      });
    } else {
      findings.push({
        id: 'admin_probe_inconclusive',
        category: 'api_abuse',
        title: t('adminProbeInconclusiveTitle'),
        detail: t('adminProbeInconclusiveDetail', { status: adminHealth.status }),
        severity: 'info',
      });
    }

    const contactBadCt = await fetchStatus(`${base}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hack: "1'; DROP TABLE users;--" }),
    });
    if (contactBadCt.status === 400) {
      findings.push({
        id: 'contact_rejects_json',
        category: 'injection',
        title: t('contactRejectsJsonTitle'),
        detail: t('contactRejectsJsonDetail'),
        severity: 'ok',
        journalLine: t('contactRejectsJsonJournal'),
      });
    } else {
      findings.push({
        id: 'contact_unexpected',
        category: 'injection',
        title: t('contactUnexpectedTitle'),
        detail: t('contactUnexpectedDetail', { status: contactBadCt.status }),
        severity: 'warning',
      });
    }

    const reportEmpty = await fetchStatus(`${base}/api/report-issue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (reportEmpty.status === 400) {
      findings.push({
        id: 'report_issue_validate',
        category: 'injection',
        title: t('reportIssueValidateTitle'),
        detail: t('reportIssueValidateDetail'),
        severity: 'ok',
        journalLine: t('reportIssueValidateJournal'),
      });
    } else {
      findings.push({
        id: 'report_issue_odd',
        category: 'injection',
        title: t('reportIssueOddTitle'),
        detail: t('reportIssueOddDetail', { status: reportEmpty.status }),
        severity: 'info',
      });
    }
  }

  findings.push({
    id: 'bruteforce_policy',
    category: 'bruteforce',
    title: t('bruteforcePolicyTitle'),
    detail: t('bruteforcePolicyDetail'),
    severity: 'info',
    journalLine: t('bruteforcePolicyJournal'),
  });

  const hasCron = !!process.env.CRON_SECRET?.trim();
  const hasAdminSecret = !!process.env.ADMIN_SECRET?.trim();
  if (!hasCron) {
    findings.push({
      id: 'cron_secret',
      category: 'env',
      title: t('cronSecretMissingTitle'),
      detail: t('cronSecretMissingDetail'),
      severity: 'warning',
    });
  } else {
    findings.push({
      id: 'cron_ok',
      category: 'env',
      title: t('cronOkTitle'),
      detail: t('cronOkDetail'),
      severity: 'ok',
    });
  }
  if (!hasAdminSecret) {
    findings.push({
      id: 'admin_secret',
      category: 'env',
      title: t('adminSecretMissingTitle'),
      detail: t('adminSecretMissingDetail'),
      severity: 'info',
    });
  }

  findings.push({
    id: 'ux_rum',
    category: 'ux_perf',
    title: t('uxRumTitle'),
    detail: t('uxRumDetail'),
    severity: 'info',
    journalLine: t('uxRumJournal'),
  });

  findings.push({
    id: 'god_mode_peer',
    category: 'ux_perf',
    title: t('godModePeerTitle'),
    detail: t('godModePeerDetail'),
    severity: 'ok',
  });

  const healthScore = scoreFromFindings(findings);

  const syntheticJournal: SecurityPerfectionAuditResult['syntheticJournal'] = [];
  for (const f of findings) {
    if (f.journalLine) {
      syntheticJournal.push({ kind: 'simulation', message: f.journalLine });
    }
  }
  syntheticJournal.push({
    kind: 'peer',
    message: t('syntheticPeerMessage'),
  });

  const peerTip = t('peerTip');

  return {
    scannedAt,
    findings,
    healthScore,
    peerTip,
    syntheticJournal,
  };
}
