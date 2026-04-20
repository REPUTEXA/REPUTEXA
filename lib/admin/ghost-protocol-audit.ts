/**
 * Ghost Protocol — structured continuous pentest (DAST / SAST / SCA).
 * One pillar per run, priority queue (retry pillar after critical failure),
 * safeguards: HTTP throttling, no destructive load, no Git writes.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RandomAuditFinding, SecurityRandomAuditTranslator } from '@/lib/admin/security-random-audit';
import {
  ghostProbeAdminPerimeter,
  ghostProbeFormInjection,
  ghostProbeHeadersAndPublicEnv,
  ghostProbeNpmOsv,
  resolvePublicBaseUrl,
  throttledFetch,
} from '@/lib/admin/security-random-audit';
import { mergeRuntimeShieldPatterns } from '@/lib/admin/ghost-shield-runtime';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { createTranslator } from 'next-intl';

/** Translator bound to Admin.ghostProtocol (and nested namespaces) from getServerMessagesForLocale + createTranslator */
type GhostProtocolTranslator = ReturnType<typeof createTranslator>;

export const GHOST_PROTOCOL_STATE_KEY = 'ghost_protocol_state';
export const GHOST_INTERCEPTION_RULES_KEY = 'ghost_interception_rules';

export type GhostLayer = 'DAST' | 'SAST' | 'SCA';

export type GhostPillarId =
  | 'dast_api_hunger'
  | 'dast_form_poisoning'
  | 'sast_logic_audit'
  | 'sca_supply_chain'
  | 'auth_session'
  | 'env_leak_hunter'
  | 'pay_stripe_integrity'
  | 'header_security'
  | 'ai_prompt_injection'
  | 'perf_database_stress';

export type GhostSeverity = 'info' | 'warning' | 'critical';

export type GhostFinding = {
  id: string;
  pillar: GhostPillarId;
  layer: GhostLayer;
  severity: GhostSeverity;
  title: string;
  detail: string;
};

export type GhostInterceptionRule = {
  id: string;
  pillar: GhostPillarId;
  layer: GhostLayer;
  title: string;
  attackSignature: string;
  pathGlob: string;
  blockMatchers: string[];
  middlewareTs: string;
  createdAt: string;
  relatedFindingId: string;
};

export type GhostQueueState = {
  ringIndex: number;
  priorityPending: GhostPillarId | null;
  lastPillar: GhostPillarId | null;
  lastRunAt: string | null;
};

export type GhostStrategicScanResult = {
  runId: string;
  scannedAt: string;
  pillar: GhostPillarId;
  pillarLabel: string;
  layer: GhostLayer;
  findings: GhostFinding[];
  interceptionRules: GhostInterceptionRule[];
  requestsExecuted: number;
  healthScoreDelta: number;
  /** Next scheduled pillar (queue preview) */
  nextPillarPreview: GhostPillarId;
};

const PILLAR_DEFS: { id: GhostPillarId; layer: GhostLayer }[] = [
  { id: 'dast_api_hunger', layer: 'DAST' },
  { id: 'dast_form_poisoning', layer: 'DAST' },
  { id: 'sast_logic_audit', layer: 'SAST' },
  { id: 'sca_supply_chain', layer: 'SCA' },
  { id: 'auth_session', layer: 'DAST' },
  { id: 'env_leak_hunter', layer: 'DAST' },
  { id: 'pay_stripe_integrity', layer: 'DAST' },
  { id: 'header_security', layer: 'DAST' },
  { id: 'ai_prompt_injection', layer: 'SAST' },
  { id: 'perf_database_stress', layer: 'SAST' },
];

function pillarLabel(t: ReturnType<typeof createTranslator>, id: GhostPillarId): string {
  return t(`pillar.${id}` as never);
}

const DEFAULT_QUEUE: GhostQueueState = {
  ringIndex: 0,
  priorityPending: null,
  lastPillar: null,
  lastRunAt: null,
};

function normalizeQueue(raw: unknown): GhostQueueState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_QUEUE };
  const o = raw as Record<string, unknown>;
  const ids = new Set(PILLAR_DEFS.map((p) => p.id));
  const pending = o.priorityPending;
  return {
    ringIndex:
      typeof o.ringIndex === 'number' && Number.isFinite(o.ringIndex)
        ? Math.max(0, Math.floor(o.ringIndex)) % PILLAR_DEFS.length
        : 0,
    priorityPending: typeof pending === 'string' && ids.has(pending as GhostPillarId) ? (pending as GhostPillarId) : null,
    lastPillar: typeof o.lastPillar === 'string' && ids.has(o.lastPillar as GhostPillarId) ? (o.lastPillar as GhostPillarId) : null,
    lastRunAt: typeof o.lastRunAt === 'string' ? o.lastRunAt : null,
  };
}

export async function loadGhostQueueState(admin: SupabaseClient): Promise<GhostQueueState> {
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', GHOST_PROTOCOL_STATE_KEY)
    .maybeSingle();
  return normalizeQueue(data?.value);
}

export async function saveGhostQueueState(admin: SupabaseClient, state: GhostQueueState): Promise<void> {
  await admin.from('legal_config').upsert({
    key: GHOST_PROTOCOL_STATE_KEY,
    value: state,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

function mapFinding(
  f: RandomAuditFinding,
  pillar: GhostPillarId,
  layer: GhostLayer
): GhostFinding {
  return {
    id: `${pillar}:${f.id}`,
    pillar,
    layer,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  };
}

function healthDeltaForFindings(findings: GhostFinding[]): number {
  let d = 0;
  for (const f of findings) {
    if (f.severity === 'critical') d -= 14;
    else if (f.severity === 'warning') d -= 7;
    else d -= 2;
  }
  if (findings.length > 0 && findings.every((f) => f.severity === 'info')) d += 4;
  return d;
}

function buildInterceptionRule(f: GhostFinding, tr: GhostProtocolTranslator): GhostInterceptionRule {
  const id = `gir-${f.id.replace(/[^a-z0-9:_-]/gi, '-').slice(0, 48)}-${Date.now().toString(36)}`;
  const matchers: string[] = [];
  if (f.pillar === 'dast_form_poisoning') {
    matchers.push(String.raw`(?i)(<script|onerror\s*=|javascript:|union\s+select|;\s*drop\s+table)`);
  }
  if (f.pillar === 'dast_api_hunger' || f.pillar === 'auth_session') {
    matchers.push(String.raw`/api/(admin|establishments|stripe)/.+`);
  }
  if (f.pillar === 'ai_prompt_injection') {
    matchers.push(String.raw`(?i)(ignore\s+(all\s+)?(previous|prior)\s+instructions)`);
  }
  if (matchers.length === 0) {
    matchers.push(tr('interception.matcherFallback', { id: f.id }));
  }

  const middlewareTs = `${tr('interception.middlewareHeader', { title: f.title })}
${tr('interception.middlewareMergeHint')}
const GHOST_BLOCK = [${matchers.map((m) => `new RegExp(${JSON.stringify(m)})`).join(', ')}];
if (GHOST_BLOCK.some((re) => re.test(request.nextUrl.pathname + request.nextUrl.search))) {
  ${tr('interception.middlewareServerLogComment')}
  return new NextResponse(JSON.stringify({ error: 'blocked_by_ghost_virtual_patch' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });
}`;

  return {
    id,
    pillar: f.pillar,
    layer: f.layer,
    title: tr('interception.ruleTitle', { title: f.title }),
    attackSignature: f.detail.slice(0, 400),
    pathGlob: 'middleware.ts',
    blockMatchers: matchers,
    middlewareTs,
    createdAt: new Date().toISOString(),
    relatedFindingId: f.id,
  };
}

export async function persistGhostInterceptionRules(
  admin: SupabaseClient,
  rules: GhostInterceptionRule[],
  godMode: boolean
): Promise<void> {
  if (!godMode || rules.length === 0) return;
  const { data } = await admin
    .from('legal_config')
    .select('value')
    .eq('key', GHOST_INTERCEPTION_RULES_KEY)
    .maybeSingle();
  const prev = Array.isArray(data?.value) ? (data!.value as GhostInterceptionRule[]) : [];
  const merged = [...prev, ...rules].slice(-35);
  await admin.from('legal_config').upsert({
    key: GHOST_INTERCEPTION_RULES_KEY,
    value: merged,
    base_language: 'en',
    updated_at: new Date().toISOString(),
  });
}

export function applyGhostHealthDelta(current: number, findings: GhostFinding[]): { nextScore: number; deltaapplied: number } {
  const raw = healthDeltaForFindings(findings);
  const next = Math.max(0, Math.min(100, current + raw));
  return { nextScore: next, deltaapplied: next - current };
}

function collectTsFiles(root: string, maxFiles: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (out.length >= maxFiles || depth > 6) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'dist' || e.name === '.git') continue;
      const p = join(dir, e.name);
      try {
        if (e.isDirectory()) walk(p, depth + 1);
        else if (/\.(ts|tsx)$/.test(e.name)) {
          const st = statSync(p);
          if (st.size < 900_000) out.push(p);
        }
      } catch {
        /* ignore */
      }
    }
  };
  try {
    walk(root, 0);
  } catch {
    /* ignore */
  }
  return out;
}

async function runDastApiHunger(
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator,
  tSec: SecurityRandomAuditTranslator
): Promise<GhostFinding[]> {
  const out: GhostFinding[] = [];
  const perimeter = await ghostProbeAdminPerimeter(base, counters, tSec);
  out.push(...perimeter.map((f) => mapFinding(f, 'dast_api_hunger', 'DAST')));

  const routes = [
    ['/api/establishments', 'findings.dastEstablishmentsLabel'],
    ['/api/auth/role', 'findings.dastAuthRoleLabel'],
  ] as const;
  for (const [path, labelKey] of routes) {
    const label = tGp(labelKey);
    const r = await throttledFetch(`${base}${path}`, { method: 'GET' }, counters);
    if (r.status === 401 || r.status === 403) {
      out.push({
        id: `dast_api_hunger:${path}:auth`,
        pillar: 'dast_api_hunger',
        layer: 'DAST',
        severity: 'info',
        title: tGp('findings.dastAuthDeniedTitle', { label, status: r.status }),
        detail: tGp('findings.dastAuthDeniedDetail'),
      });
    } else if (r.ok) {
      out.push({
        id: `dast_api_hunger:${path}:open`,
        pillar: 'dast_api_hunger',
        layer: 'DAST',
        severity: 'critical',
        title: tGp('findings.dastOpen200Title', { label }),
        detail: tGp('findings.dastOpen200Detail'),
      });
    } else {
      out.push({
        id: `dast_api_hunger:${path}:other`,
        pillar: 'dast_api_hunger',
        layer: 'DAST',
        severity: 'info',
        title: tGp('findings.dastOtherHttpTitle', { label, status: r.status }),
        detail: tGp('findings.dastOtherDetail'),
      });
    }
  }
  return out;
}

async function runDastFormPoisoning(
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator,
  tSec: SecurityRandomAuditTranslator
): Promise<GhostFinding[]> {
  if (!base) {
    return [
      {
        id: 'dast_form_poisoning:no-base',
        pillar: 'dast_form_poisoning',
        layer: 'DAST',
        severity: 'warning',
        title: tGp('findings.formNoBaseTitle'),
        detail: tGp('findings.formNoBaseDetail'),
      },
    ];
  }
  const raw = await ghostProbeFormInjection(base, counters, tSec);
  return raw.map((f) => mapFinding(f, 'dast_form_poisoning', 'DAST'));
}

function runSastLogicAudit(tGp: GhostProtocolTranslator): GhostFinding[] {
  const roots = [join(process.cwd(), 'app', 'api'), join(process.cwd(), 'lib')];
  const files = roots.flatMap((r) => collectTsFiles(r, 120));
  const findings: GhostFinding[] = [];
  const risky: { needle: RegExp; titleKey: string; severity: GhostSeverity; id: string }[] = [
    { needle: /\beval\s*\(/, titleKey: 'findings.sastEvalTitle', severity: 'critical', id: 'eval' },
    { needle: /new\s+Function\s*\(/, titleKey: 'findings.sastNewFunctionTitle', severity: 'warning', id: 'new-function' },
    {
      needle: /dangerouslySetInnerHTML/,
      titleKey: 'findings.sastDhtmlTitle',
      severity: 'warning',
      id: 'dhtml',
    },
  ];
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const rel = relative(process.cwd(), file);
    for (const { needle, titleKey, severity, id } of risky) {
      if (needle.test(content)) {
        findings.push({
          id: `sast:${id}:${rel}`,
          pillar: 'sast_logic_audit',
          layer: 'SAST',
          severity,
          title: tGp(titleKey as never),
          detail: tGp('findings.sastFileDetail', { file: rel }),
        });
      }
    }
  }
  if (findings.length === 0) {
    findings.push({
      id: 'sast:clean-scan',
      pillar: 'sast_logic_audit',
      layer: 'SAST',
      severity: 'info',
      title: tGp('findings.sastCleanTitle'),
      detail: tGp('findings.sastCleanDetail', { count: files.length }),
    });
  }
  return findings;
}

async function runScaSupply(
  counters: { n: number },
  tSec: SecurityRandomAuditTranslator
): Promise<GhostFinding[]> {
  const raw = await ghostProbeNpmOsv(counters, tSec);
  return raw.map((f) => mapFinding(f, 'sca_supply_chain', 'SCA'));
}

async function runAuthSession(
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator
): Promise<GhostFinding[]> {
  const findings: GhostFinding[] = [];
  if (!base) {
    findings.push({
      id: 'auth:no-base',
      pillar: 'auth_session',
      layer: 'DAST',
      severity: 'warning',
      title: tGp('findings.authNoBaseTitle'),
      detail: tGp('findings.authNoBaseDetail'),
    });
    return findings;
  }
  const r = await throttledFetch(`${base}/api/auth/role`, { method: 'GET', headers: { Accept: 'application/json' } }, counters);
  if (r.status === 401 || r.status === 403) {
    findings.push({
      id: 'auth:role-unauth',
      pillar: 'auth_session',
      layer: 'DAST',
      severity: 'info',
      title: tGp('findings.authRoleUnauthTitle'),
      detail: tGp('findings.authRoleUnauthDetail', { status: r.status }),
    });
  } else if (r.ok) {
    findings.push({
      id: 'auth:role-open',
      pillar: 'auth_session',
      layer: 'DAST',
      severity: 'critical',
      title: tGp('findings.authRoleOpenTitle'),
      detail: tGp('findings.authRoleOpenDetail'),
    });
  } else {
    findings.push({
      id: 'auth:role-other',
      pillar: 'auth_session',
      layer: 'DAST',
      severity: 'info',
      title: tGp('findings.authRoleOtherTitle', { status: r.status }),
      detail: tGp('findings.authRoleOtherDetail'),
    });
  }
  return findings;
}

async function runEnvLeakHunter(
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator
): Promise<GhostFinding[]> {
  if (!base) {
    return [
      {
        id: 'env:no-base',
        pillar: 'env_leak_hunter',
        layer: 'DAST',
        severity: 'warning',
        title: tGp('findings.envNoBaseTitle'),
        detail: tGp('findings.envNoBaseDetail'),
      },
    ];
  }
  const paths = ['/.env', '/.git/HEAD', '/.env.local', '/package.json'];
  const findings: GhostFinding[] = [];
  for (const p of paths) {
    const r = await throttledFetch(`${base}${p}`, { method: 'GET', headers: { Accept: '*/*' } }, counters);
    const ct = r.headers.get('content-type') ?? '';
    if (r.ok && r.status === 200 && /json|text|plain/i.test(ct)) {
      const critical = p.includes('.env') || p.includes('.git');
      findings.push({
        id: `env:exposed:${p}`,
        pillar: 'env_leak_hunter',
        layer: 'DAST',
        severity: critical ? 'critical' : 'warning',
        title: tGp('findings.envExposedTitle', { path: p }),
        detail: tGp('findings.envExposedDetail'),
      });
    } else {
      findings.push({
        id: `env:ok:${p}`,
        pillar: 'env_leak_hunter',
        layer: 'DAST',
        severity: 'info',
        title: tGp('findings.envOkTitle', { path: p, status: r.status }),
        detail: tGp('findings.envOkDetail'),
      });
    }
  }
  return findings;
}

async function runPayStripe(
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator
): Promise<GhostFinding[]> {
  const findings: GhostFinding[] = [];
  if (!base) {
    findings.push({
      id: 'pay:no-base',
      pillar: 'pay_stripe_integrity',
      layer: 'DAST',
      severity: 'warning',
      title: tGp('findings.payNoBaseTitle'),
      detail: tGp('findings.payNoBaseDetail'),
    });
    return findings;
  }
  const r = await throttledFetch(
    `${base}/api/stripe/checkout?planType=dominator&locale=fr`,
    { method: 'GET' },
    counters
  );
  if (r.status === 401 || r.status === 403 || r.status === 405) {
    findings.push({
      id: 'pay:checkout-gated',
      pillar: 'pay_stripe_integrity',
      layer: 'DAST',
      severity: 'info',
      title: tGp('findings.payCheckoutGatedTitle'),
      detail: tGp('findings.payCheckoutGatedDetail', { status: r.status }),
    });
  } else {
    findings.push({
      id: 'pay:checkout-code',
      pillar: 'pay_stripe_integrity',
      layer: 'DAST',
      severity: 'info',
      title: tGp('findings.payCheckoutOtherTitle', { status: r.status }),
      detail: tGp('findings.payCheckoutOtherDetail'),
    });
  }
  return findings;
}

async function runHeaderSecurity(
  base: string,
  counters: { n: number },
  tSec: SecurityRandomAuditTranslator
): Promise<GhostFinding[]> {
  const raw = await ghostProbeHeadersAndPublicEnv(base, counters, tSec);
  return raw.map((f) => mapFinding(f, 'header_security', 'DAST'));
}

function runAiPromptSurface(tGp: GhostProtocolTranslator): GhostFinding[] {
  const findings: GhostFinding[] = [];
  const routeFile = join(process.cwd(), 'app', 'api', 'reviews', 'process', 'route.ts');
  try {
    const src = readFileSync(routeFile, 'utf-8');
    const hasAuth =
      src.includes('getUser') ||
      src.includes('auth.getUser') ||
      src.includes("role === 'admin'") ||
      src.includes('requireAuth');
    if (!hasAuth) {
      findings.push({
        id: 'ai:reviews-process-open',
        pillar: 'ai_prompt_injection',
        layer: 'SAST',
        severity: 'critical',
        title: tGp('findings.aiRouteOpenTitle'),
        detail: tGp('findings.aiRouteOpenDetail'),
      });
    } else {
      findings.push({
        id: 'ai:reviews-process-auth-marker',
        pillar: 'ai_prompt_injection',
        layer: 'SAST',
        severity: 'info',
        title: tGp('findings.aiRouteAuthTitle'),
        detail: tGp('findings.aiRouteAuthDetail'),
      });
    }
  } catch {
    findings.push({
      id: 'ai:no-route-file',
      pillar: 'ai_prompt_injection',
      layer: 'SAST',
      severity: 'info',
      title: tGp('findings.aiNoRouteFileTitle'),
      detail: tGp('findings.aiNoRouteFileDetail'),
    });
  }
  return findings;
}

function runPerfHeuristic(tGp: GhostProtocolTranslator): GhostFinding[] {
  const apiRoot = join(process.cwd(), 'app', 'api');
  const files = collectTsFiles(apiRoot, 80);
  const findings: GhostFinding[] = [];
  const selectStar = /\.from\([^)]+\)\s*\.\s*select\s*\(\s*['']\s*\*?\s*['']\s*\)/;
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    if (!selectStar.test(content)) continue;
    if (content.includes('.limit(')) continue;
    const rel = relative(process.cwd(), file);
    findings.push({
      id: `perf:wide:${rel}`,
      pillar: 'perf_database_stress',
      layer: 'SAST',
      severity: 'warning',
      title: tGp('findings.perfWideTitle'),
      detail: tGp('findings.perfWideDetail', { file: rel }),
    });
  }
  if (findings.length === 0) {
    findings.push({
      id: 'perf:ok-sample',
      pillar: 'perf_database_stress',
      layer: 'SAST',
      severity: 'info',
      title: tGp('findings.perfOkTitle'),
      detail: tGp('findings.perfOkDetail', { count: files.length }),
    });
  }
  return findings;
}

async function runOnePillar(
  pillar: GhostPillarId,
  base: string,
  counters: { n: number },
  tGp: GhostProtocolTranslator,
  tSec: SecurityRandomAuditTranslator
): Promise<GhostFinding[]> {
  switch (pillar) {
    case 'dast_api_hunger':
      return runDastApiHunger(base, counters, tGp, tSec);
    case 'dast_form_poisoning':
      return runDastFormPoisoning(base, counters, tGp, tSec);
    case 'sast_logic_audit':
      return Promise.resolve(runSastLogicAudit(tGp));
    case 'sca_supply_chain':
      return runScaSupply(counters, tSec);
    case 'auth_session':
      return runAuthSession(base, counters, tGp);
    case 'env_leak_hunter':
      return runEnvLeakHunter(base, counters, tGp);
    case 'pay_stripe_integrity':
      return runPayStripe(base, counters, tGp);
    case 'header_security':
      return runHeaderSecurity(base, counters, tSec);
    case 'ai_prompt_injection':
      return Promise.resolve(runAiPromptSurface(tGp));
    case 'perf_database_stress':
      return Promise.resolve(runPerfHeuristic(tGp));
    default:
      return [];
  }
}

/**
 * One mission per call — ring rotation + priority if the previous run had a critical failure.
 * God mode: stacks virtual interception rules (no on-disk patch).
 * persistAutoShield: merges safe patterns (query string) for middleware — without editing the repo.
 */
export async function executeStrategicScan(
  admin: SupabaseClient | null,
  opts?: {
    godMode?: boolean;
    persistAutoShield?: boolean;
    /** Force a pillar (manual run) */
    forcePillar?: GhostPillarId;
  }
): Promise<GhostStrategicScanResult> {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const tGhost = createTranslator({ locale, messages, namespace: 'Admin.ghostProtocol' });
  const tSec = createTranslator({ locale, messages, namespace: 'Admin.securityRandomAudit' });

  const runId = `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const scannedAt = new Date().toISOString();
  const base = resolvePublicBaseUrl();
  const counters = { n: 0 };

  const queue: GhostQueueState =
    admin != null ? await loadGhostQueueState(admin) : { ...DEFAULT_QUEUE };

  let pillar: GhostPillarId;
  if (opts?.forcePillar) {
    pillar = opts.forcePillar;
  } else if (queue.priorityPending) {
    pillar = queue.priorityPending;
    queue.priorityPending = null;
  } else {
    pillar = PILLAR_DEFS[queue.ringIndex % PILLAR_DEFS.length]!.id;
    queue.ringIndex = (queue.ringIndex + 1) % PILLAR_DEFS.length;
  }

  const meta = PILLAR_DEFS.find((p) => p.id === pillar)!;
  const pillarLabelResolved = pillarLabel(tGhost, pillar);
  const findings = await runOnePillar(pillar, base, counters, tGhost, tSec);

  if (findings.some((f) => f.severity === 'critical') && admin != null && !opts?.forcePillar) {
    queue.priorityPending = pillar;
  }

  queue.lastPillar = pillar;
  queue.lastRunAt = scannedAt;
  if (admin != null) {
    await saveGhostQueueState(admin, queue);
  }

  const interceptionRules: GhostInterceptionRule[] = [];
  if (opts?.godMode) {
    for (const f of findings) {
      if (f.severity === 'warning' || f.severity === 'critical') {
        interceptionRules.push(buildInterceptionRule(f, tGhost));
      }
    }
  }

  if (admin != null && opts?.godMode && interceptionRules.length > 0) {
    await persistGhostInterceptionRules(admin, interceptionRules, true);
  }

  if (admin != null && opts?.persistAutoShield && findings.length > 0) {
    try {
      await mergeRuntimeShieldPatterns(admin, findings, runId);
    } catch (e) {
      console.warn('[ghost-protocol] mergeRuntimeShieldPatterns', e);
    }
  }

  const healthScoreDelta = healthDeltaForFindings(findings);

  const nextPreview =
    queue.priorityPending ??
    PILLAR_DEFS[queue.ringIndex % PILLAR_DEFS.length]!.id;

  if (admin != null) {
    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: tGhost('logScanMessage', {
        label: pillarLabelResolved,
        count: findings.length,
      }),
      metadata: {
        kind: 'ghost_protocol_scan',
        runId,
        pillar,
        layer: meta.layer,
        findingIds: findings.map((f) => f.id),
        interceptionRuleIds: interceptionRules.map((r) => r.id),
        requestsExecuted: counters.n,
        godMode: !!opts?.godMode,
        persistAutoShield: !!opts?.persistAutoShield,
        healthScoreDelta,
        nextPillarPreview: nextPreview,
      },
      legal_version: null,
    });
  }

  return {
    runId,
    scannedAt,
    pillar,
    pillarLabel: pillarLabelResolved,
    layer: meta.layer,
    findings,
    interceptionRules,
    requestsExecuted: counters.n,
    healthScoreDelta,
    nextPillarPreview: nextPreview,
  };
}
