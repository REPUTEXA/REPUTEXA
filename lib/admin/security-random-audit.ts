/**
 * Autonomous security agent — rotating axes (light red team).
 * Safeguards: max 5 req/s to the instance, no data deletion, no price changes.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';

import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';

/** Translations for `Admin.securityRandomAudit` (shared probes: Ghost Protocol + random audit). */
export type SecurityRandomAuditTranslator = ReturnType<typeof createTranslator>;

export const SECURITY_VIRTUAL_PATCHES_KEY = 'security_virtual_patches_queue';

export type AuditAxis = 'injection' | 'permissions' | 'dependencies' | 'config';

export type RandomAuditSeverity = 'info' | 'warning' | 'critical';

export type RandomAuditFinding = {
  id: string;
  axis: AuditAxis;
  severity: RandomAuditSeverity;
  title: string;
  detail: string;
};

export type VirtualPatch = {
  id: string;
  axis: AuditAxis;
  title: string;
  targetHint: string;
  description: string;
  snippet: string;
};

export type RandomAuditResult = {
  runId: string;
  axis: AuditAxis;
  scannedAt: string;
  findings: RandomAuditFinding[];
  virtualPatches: VirtualPatch[];
  requestsExecuted: number;
};

const MIN_REQUEST_INTERVAL_MS = 210; // ≤ 5 req/s
let throttleChain: Promise<void> = Promise.resolve();

export function resolvePublicBaseUrl(): string {
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

export async function throttledFetch(
  url: string,
  init: RequestInit,
  counters: { n: number }
): Promise<Response> {
  throttleChain = throttleChain.then(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, MIN_REQUEST_INTERVAL_MS);
      })
  );
  await throttleChain;
  counters.n += 1;
  return fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
}

function pickAxis(): AuditAxis {
  const axes: AuditAxis[] = ['injection', 'permissions', 'dependencies', 'config'];
  return axes[Math.floor(Math.random() * axes.length)]!;
}

function buildVirtualPatchesForFinding(
  f: RandomAuditFinding,
  tr: SecurityRandomAuditTranslator
): VirtualPatch | null {
  const id = `vp-${f.id}-${Date.now().toString(36)}`;
  switch (f.axis) {
    case 'injection':
      return {
        id,
        axis: f.axis,
        title: tr('vpInjectionTitle', { findingTitle: f.title }),
        targetHint: tr('vpInjectionTargetHint'),
        description: tr('vpInjectionDescription'),
        snippet: tr('vpInjectionSnippet'),
      };
    case 'permissions':
      return {
        id,
        axis: f.axis,
        title: tr('vpPermissionsTitle', { findingTitle: f.title }),
        targetHint: tr('vpPermissionsTargetHint'),
        description: tr('vpPermissionsDescription'),
        snippet: tr('vpPermissionsSnippet'),
      };
    case 'dependencies':
      return {
        id,
        axis: f.axis,
        title: tr('vpDependenciesTitle', { findingTitle: f.title }),
        targetHint: tr('vpDependenciesTargetHint'),
        description: tr('vpDependenciesDescription'),
        snippet: tr('vpDependenciesSnippet'),
      };
    case 'config':
      return {
        id,
        axis: f.axis,
        title: tr('vpConfigTitle', { findingTitle: f.title }),
        targetHint: tr('vpConfigTargetHint'),
        description: tr('vpConfigDescription'),
        snippet: tr('vpConfigSnippet'),
      };
    default:
      return null;
  }
}

async function axisInjection(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  const out: RandomAuditFinding[] = [];
  const xssLike = encodeURIComponent('<script>alert(1)</script>');
  const sqlLike = "1'; WAITFOR DELAY '0:0:1'--";

  const r1 = await throttledFetch(`${base}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inject: sqlLike }),
  }, counters);
  if (r1.status === 400) {
    out.push({
      id: 'inj-contact-json',
      axis: 'injection',
      severity: 'info',
      title: tr('injContactJsonOkTitle'),
      detail: tr('injContactJsonOkDetail'),
    });
  } else {
    out.push({
      id: 'inj-contact-json-odd',
      axis: 'injection',
      severity: 'warning',
      title: tr('injContactJsonOddTitle'),
      detail: tr('injContactJsonOddDetail', { status: r1.status }),
    });
  }

  const r2 = await throttledFetch(
    `${base}/api/report-issue`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bugType: 'other',
        priority: 'low',
        title: `<img src=x onerror=alert(1)>${xssLike}`,
        description: sqlLike,
        steps: '<svg onload=alert(1)>',
        email: 'invalid-email-format',
      }),
    },
    counters
  );
  if (r2.status === 400 || r2.status === 429) {
    out.push({
      id: 'inj-report-validate',
      axis: 'injection',
      severity: 'info',
      title: tr('injReportValidateTitle'),
      detail: tr('injReportValidateDetail', { status: r2.status }),
    });
  } else if (r2.ok) {
    out.push({
      id: 'inj-report-accept',
      axis: 'injection',
      severity: 'warning',
      title: tr('injReportAcceptTitle'),
      detail: tr('injReportAcceptDetail'),
    });
  }

  const r3 = await throttledFetch(
    `${base}/api/auth/verify-signup-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    counters
  );
  if (r3.status === 400) {
    out.push({
      id: 'inj-verify-otp-empty',
      axis: 'injection',
      severity: 'info',
      title: tr('injVerifyOtpTitle'),
      detail: tr('injVerifyOtpDetail'),
    });
  }

  return out;
}

async function axisPermissions(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  const out: RandomAuditFinding[] = [];
  const routes = [
    ['/api/admin/health-check', 'permRouteHealth'],
    ['/api/admin/security-perfection', 'permRouteSecurity'],
    ['/api/admin/stats', 'permRouteStats'],
  ] as const;
  for (const [path, labelKey] of routes) {
    const label = tr(labelKey);
    const r = await throttledFetch(`${base}${path}`, { method: 'GET' }, counters);
    if (r.status === 401 || r.status === 403) {
      out.push({
        id: `perm-${path.replace(/\//g, '-')}`,
        axis: 'permissions',
        severity: 'info',
        title: tr('permNoSessionTitle', { label, status: r.status }),
        detail: tr('permNoSessionDetail'),
      });
    } else if (r.ok) {
      out.push({
        id: `perm-leak-${path.replace(/\//g, '-')}`,
        axis: 'permissions',
        severity: 'critical',
        title: tr('permOpen200Title', { label }),
        detail: tr('permOpen200Detail'),
      });
    } else {
      out.push({
        id: `perm-unk-${path.replace(/\//g, '-')}`,
        axis: 'permissions',
        severity: 'info',
        title: tr('permOtherTitle', { label, status: r.status }),
        detail: tr('permOtherDetail'),
      });
    }
  }
  return out;
}

type OsvBatch = { results?: Array<{ vulns?: unknown[] }> };

async function osvBatchQuery(
  packages: { name: string; version: string }[],
  counters: { n: number }
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const r = await throttledFetch(
    'https://api.osv.dev/v1/querybatch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: packages.map((p) => ({
          package: { ecosystem: 'npm', name: p.name },
          version: p.version,
        })),
      }),
    },
    counters
  );
  if (!r.ok) return map;
  const j = (await r.json()) as OsvBatch;
  const results = j.results ?? [];
  packages.forEach((p, i) => {
    const vulns = results[i]?.vulns;
    map.set(p.name, Array.isArray(vulns) ? vulns.length : 0);
  });
  return map;
}

async function axisDependencies(
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  const out: RandomAuditFinding[] = [];
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf-8');
    pkg = JSON.parse(raw) as typeof pkg;
  } catch {
    return [
      {
        id: 'dep-read-fail',
        axis: 'dependencies',
        severity: 'warning',
        title: tr('depReadFailTitle'),
        detail: tr('depReadFailDetail'),
      },
    ];
  }

  const deps = pkg.dependencies ?? {};
  const pick = ['next', 'stripe', '@supabase/supabase-js'] as const;
  const versions: { name: string; version: string }[] = [];
  for (const name of pick) {
    const v = deps[name];
    if (typeof v === 'string') {
      const clean = v.replace(/^[\^~]/, '');
      versions.push({ name, version: clean });
    }
  }
  if (versions.length === 0) {
    out.push({
      id: 'dep-none',
      axis: 'dependencies',
      severity: 'info',
      title: tr('depNoneTitle'),
      detail: tr('depNoneDetail'),
    });
    return out;
  }

  let counts: Map<string, number>;
  try {
    counts = await osvBatchQuery(versions, counters);
  } catch {
    return [
      {
        id: 'dep-osv-error',
        axis: 'dependencies',
        severity: 'info',
        title: tr('depOsvErrorTitle'),
        detail: tr('depOsvErrorDetail'),
      },
    ];
  }
  for (const { name } of versions) {
    const c = counts.get(name) ?? 0;
    if (c > 0) {
      out.push({
        id: `dep-osv-${name}`,
        axis: 'dependencies',
        severity: c >= 3 ? 'critical' : 'warning',
        title: tr('depOsvReportsTitle', { count: c, name }),
        detail: tr('depOsvReportsDetail'),
      });
    } else {
      out.push({
        id: `dep-osv-ok-${name}`,
        axis: 'dependencies',
        severity: 'info',
        title: tr('depOsvOkTitle', { name }),
        detail: tr('depOsvOkDetail'),
      });
    }
  }
  return out;
}

async function axisConfig(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  const out: RandomAuditFinding[] = [];
  if (!base) {
    return [
      {
        id: 'cfg-no-base',
        axis: 'config',
        severity: 'warning',
        title: tr('cfgNoBaseTitle'),
        detail: tr('cfgNoBaseDetail'),
      },
    ];
  }

  const r = await throttledFetch(
    base,
    { method: 'GET', redirect: 'follow', headers: { Accept: 'text/html' } },
    counters
  );
  if (!r.ok) {
    out.push({
      id: 'cfg-fetch',
      axis: 'config',
      severity: 'info',
      title: tr('cfgFetchTitle', { status: r.status }),
      detail: tr('cfgFetchDetail'),
    });
    return out;
  }

  const hsts = r.headers.get('strict-transport-security');
  if (!hsts) {
    out.push({
      id: 'cfg-no-hsts',
      axis: 'config',
      severity: 'warning',
      title: tr('cfgNoHstsTitle'),
      detail: tr('cfgNoHstsDetail'),
    });
  } else {
    out.push({
      id: 'cfg-hsts',
      axis: 'config',
      severity: 'info',
      title: tr('cfgHstsTitle'),
      detail: hsts.slice(0, 80),
    });
  }

  const csp = r.headers.get('content-security-policy');
  if (!csp) {
    out.push({
      id: 'cfg-no-csp',
      axis: 'config',
      severity: 'info',
      title: tr('cfgNoCspTitle'),
      detail: tr('cfgNoCspDetail'),
    });
  }

  const suspicious = Object.keys(process.env).filter(
    (k) =>
      k.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|TOKEN|PRIVATE|STRIPE_SECRET|SUPABASE_SERVICE/i.test(k)
  );
  if (suspicious.length > 0) {
    const varsList = `${suspicious.slice(0, 6).join(', ')}${suspicious.length > 6 ? '…' : ''}`;
    out.push({
      id: 'cfg-leak-public',
      axis: 'config',
      severity: 'critical',
      title: tr('cfgLeakPublicTitle'),
      detail: tr('cfgLeakPublicDetail', { vars: varsList }),
    });
  }

  return out;
}

export async function persistVirtualPatchesQueue(
  admin: SupabaseClient,
  patches: VirtualPatch[],
  godMode: boolean
): Promise<void> {
  if (!godMode || patches.length === 0) return;
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', SECURITY_VIRTUAL_PATCHES_KEY)
    .maybeSingle();
  const raw = data?.value;
  const prev = Array.isArray(raw) ? (raw as VirtualPatch[]) : [];
  const merged = [...prev, ...patches].slice(-25);
  await admin.from('legal_config').upsert({
    key: SECURITY_VIRTUAL_PATCHES_KEY,
    value: merged,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

/**
 * Unpredictable 24/7 routine: one random axis + virtual patches when there are findings.
 * @param godMode — when true, virtual patches are also written to `legal_config` (human-review queue).
 */
export async function runRandomAudit(
  admin: SupabaseClient | null,
  opts?: { godMode?: boolean }
): Promise<RandomAuditResult> {
  const runId = `ra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const scannedAt = new Date().toISOString();
  const axis = pickAxis();
  const counters = { n: 0 };
  const base = resolvePublicBaseUrl();

  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const tr = createTranslator({ locale, messages, namespace: 'Admin.securityRandomAudit' });

  let findings: RandomAuditFinding[] = [];

  switch (axis) {
    case 'injection':
      if (base) findings = await axisInjection(base, counters, tr);
      else
        findings.push({
          id: 'inj-no-base',
          axis: 'injection',
          severity: 'warning',
          title: tr('injNoBaseTitle'),
          detail: tr('injNoBaseDetail'),
        });
      break;
    case 'permissions':
      if (base) findings = await axisPermissions(base, counters, tr);
      else
        findings.push({
          id: 'perm-no-base',
          axis: 'permissions',
          severity: 'warning',
          title: tr('permNoBaseTitle'),
          detail: tr('permNoBaseDetail'),
        });
      break;
    case 'dependencies':
      findings = await axisDependencies(counters, tr);
      break;
    case 'config':
      findings = await axisConfig(base, counters, tr);
      break;
    default:
      break;
  }

  const virtualPatches: VirtualPatch[] = [];
  for (const f of findings) {
    if (f.severity === 'critical' || f.severity === 'warning') {
      const vp = buildVirtualPatchesForFinding(f, tr);
      if (vp) virtualPatches.push(vp);
    }
  }

  if (admin && opts?.godMode && virtualPatches.length > 0) {
    await persistVirtualPatchesQueue(admin, virtualPatches, true);
  }

  if (admin) {
    const axisLabelMap: Record<AuditAxis, string> = {
      injection: tr('axisLabel_injection'),
      permissions: tr('axisLabel_permissions'),
      dependencies: tr('axisLabel_dependencies'),
      config: tr('axisLabel_config'),
    };
    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: tr('auditLogMessage', {
        axis: axisLabelMap[axis],
        findingsCount: findings.length,
        patchesCount: virtualPatches.length,
      }),
      metadata: {
        kind: 'security_random_audit',
        runId,
        axis,
        findingIds: findings.map((x) => x.id),
        virtualPatchIds: virtualPatches.map((x) => x.id),
        requestsExecuted: counters.n,
        godMode: !!opts?.godMode,
      },
      legal_version: null,
    });
  }

  return {
    runId,
    axis,
    scannedAt,
    findings,
    virtualPatches,
    requestsExecuted: counters.n,
  };
}

/** Reused by Ghost Protocol (continuous pentest) to avoid duplicating OSV / probe logic. */
export async function ghostProbeNpmOsv(
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  return axisDependencies(counters, tr);
}

export async function ghostProbeFormInjection(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  return axisInjection(base, counters, tr);
}

export async function ghostProbeAdminPerimeter(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  return axisPermissions(base, counters, tr);
}

export async function ghostProbeHeadersAndPublicEnv(
  base: string,
  counters: { n: number },
  tr: SecurityRandomAuditTranslator
): Promise<RandomAuditFinding[]> {
  return axisConfig(base, counters, tr);
}
