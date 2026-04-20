'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';

type Svc = { name: string; status: 'ok' | 'degraded' | 'critical' };

type HealthPayload = {
  overall: 'ok' | 'degraded' | 'critical';
  services: Svc[];
  checked_at: string;
};

type ModStatus = 'ok' | 'degraded' | 'critical';

type ModuleKey =
  | 'security'
  | 'compliance'
  | 'auditKit'
  | 'blackBox'
  | 'iaForge'
  | 'nexus'
  | 'codeGuardian'
  | 'sentinel'
  | 'legalPublish';

type ModuleMap = Partial<Record<ModuleKey, ModStatus>>;

type ModuleHintMap = Partial<Record<ModuleKey, string>>;

const DOT_STATUS_LOADING = 'loading' as const;

const ADMIN_MODULE_DEFS: { moduleKey: ModuleKey; href: string }[] = [
  { moduleKey: 'security', href: '/dashboard/admin/security-perfection' },
  { moduleKey: 'compliance', href: '/dashboard/admin/compliance' },
  { moduleKey: 'auditKit', href: '/dashboard/admin/compliance-audit-kit' },
  { moduleKey: 'blackBox', href: '/dashboard/admin/black-box-archive' },
  { moduleKey: 'iaForge', href: '/dashboard/admin/ia-forge' },
  { moduleKey: 'nexus', href: '/dashboard/admin/nexus-support' },
  { moduleKey: 'codeGuardian', href: '/dashboard/admin/code-guardian' },
  { moduleKey: 'sentinel', href: '/dashboard/admin#sentinel-panel' },
  { moduleKey: 'legalPublish', href: '/dashboard/admin#legal-publish' },
];

type OpsModTitleKey =
  | 'mod_security_title'
  | 'mod_compliance_title'
  | 'mod_auditKit_title'
  | 'mod_blackBox_title'
  | 'mod_iaForge_title'
  | 'mod_nexus_title'
  | 'mod_codeGuardian_title'
  | 'mod_sentinel_title'
  | 'mod_legalPublish_title';

type OpsModBlurbKey =
  | 'mod_security_blurb'
  | 'mod_compliance_blurb'
  | 'mod_auditKit_blurb'
  | 'mod_blackBox_blurb'
  | 'mod_iaForge_blurb'
  | 'mod_nexus_blurb'
  | 'mod_codeGuardian_blurb'
  | 'mod_sentinel_blurb'
  | 'mod_legalPublish_blurb';

const MOD_TITLE_KEYS: Record<ModuleKey, OpsModTitleKey> = {
  security: 'mod_security_title',
  compliance: 'mod_compliance_title',
  auditKit: 'mod_auditKit_title',
  blackBox: 'mod_blackBox_title',
  iaForge: 'mod_iaForge_title',
  nexus: 'mod_nexus_title',
  codeGuardian: 'mod_codeGuardian_title',
  sentinel: 'mod_sentinel_title',
  legalPublish: 'mod_legalPublish_title',
};

const MOD_BLURB_KEYS: Record<ModuleKey, OpsModBlurbKey> = {
  security: 'mod_security_blurb',
  compliance: 'mod_compliance_blurb',
  auditKit: 'mod_auditKit_blurb',
  blackBox: 'mod_blackBox_blurb',
  iaForge: 'mod_iaForge_blurb',
  nexus: 'mod_nexus_blurb',
  codeGuardian: 'mod_codeGuardian_blurb',
  sentinel: 'mod_sentinel_blurb',
  legalPublish: 'mod_legalPublish_blurb',
};

function formatCheckedAtRelative(iso: string | null, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return iso;
  const sec = Math.round((Date.now() - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (sec < 60) return rtf.format(-sec, 'second');
  const min = Math.floor(sec / 60);
  if (min < 60) return rtf.format(-min, 'minute');
  const hours = Math.floor(min / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(d);
}

function Dot({
  status,
  titleOk,
  titleWarn,
  titleProblem,
}: {
  status: 'ok' | 'degraded' | 'critical' | 'loading';
  titleOk: string;
  titleWarn: string;
  titleProblem: string;
}) {
  if (status === 'loading') {
    return <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin shrink-0" />;
  }
  if (status === 'ok') {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] shrink-0"
        title={titleOk}
      />
    );
  }
  if (status === 'degraded') {
    return (
      <span
        className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)] shrink-0"
        title={titleWarn}
      />
    );
  }
  return (
    <span
      className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)] shrink-0"
      title={titleProblem}
    />
  );
}

function worst(a: 'ok' | 'degraded' | 'critical', b: 'ok' | 'degraded' | 'critical'): 'ok' | 'degraded' | 'critical' {
  const o = { ok: 0, degraded: 1, critical: 2 };
  return o[a] >= o[b] ? a : b;
}

export type AdminOpsStatusBarProps = {
  vaultLastStatus?: string | null;
  guardianStatus?: string;
  pendingGuardianDrafts?: number;
};

export function AdminOpsStatusBar({
  vaultLastStatus = null,
  guardianStatus = 'idle',
  pendingGuardianDrafts = 0,
}: AdminOpsStatusBarProps) {
  const t = useTranslations('Dashboard.adminOpsStatusBar');
  const locale = useLocale();
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [modules, setModules] = useState<ModuleMap | null>(null);
  const [moduleHints, setModuleHints] = useState<ModuleHintMap | null>(null);
  const [opsCheckedAt, setOpsCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async (opts?: { allowHidden?: boolean }) => {
    if (
      !opts?.allowHidden &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    setLoading(true);
    setModulesLoading(true);
    try {
      const [hRes, mRes] = await Promise.all([
        fetch('/api/admin/health-check', { cache: 'no-store' }),
        fetch('/api/admin/ops-modules', { cache: 'no-store' }),
      ]);

      if (hRes.ok) {
        const j = (await hRes.json()) as HealthPayload & { error?: string };
        setHealth(j);
        setErr(null);
      } else {
        const j = await hRes.json().catch(() => ({}));
        throw new Error(typeof (j as { error?: string }).error === 'string' ? (j as { error: string }).error : `HTTP ${hRes.status}`);
      }

      if (mRes.ok) {
        const mj = (await mRes.json()) as {
          modules?: ModuleMap;
          moduleHints?: ModuleHintMap;
          checked_at?: string;
        };
        setModules(mj.modules ?? {});
        setModuleHints(mj.moduleHints ?? null);
        setOpsCheckedAt(typeof mj.checked_at === 'string' ? mj.checked_at : null);
      } else {
        setModules({});
        setModuleHints(null);
        setOpsCheckedAt(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('healthUnavailable'));
      setHealth(null);
      setModules({});
      setModuleHints(null);
      setOpsCheckedAt(null);
    } finally {
      setLoading(false);
      setModulesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load({ allowHidden: true });
    const tmr = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(tmr);
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void load({ allowHidden: true });
        setTick((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  useEffect(() => {
    if (!opsCheckedAt) return;
    const tmr = window.setInterval(() => setTick((n) => n + 1), 10_000);
    return () => window.clearInterval(tmr);
  }, [opsCheckedAt]);

  const vaultStatus: 'ok' | 'degraded' | 'critical' = (() => {
    if (vaultLastStatus === 'failed') return 'critical';
    if (vaultLastStatus === 'ok') return 'ok';
    if (vaultLastStatus === 'running') return 'degraded';
    return 'degraded';
  })();

  const guardianDot: 'ok' | 'degraded' | 'critical' = (() => {
    const s = String(guardianStatus ?? '').toLowerCase();
    if (s.includes('fail') || s.includes('error')) return 'critical';
    if (pendingGuardianDrafts > 0) return 'degraded';
    return 'ok';
  })();

  let rollup: 'ok' | 'degraded' | 'critical' = 'ok';
  if (health) rollup = health.overall;
  else if (!loading && err) rollup = 'critical';
  else if (!loading && !health) rollup = 'degraded';

  rollup = worst(rollup, vaultStatus);
  rollup = worst(rollup, guardianDot);
  if (err) rollup = worst(rollup, 'critical');

  if (modules && Object.keys(modules).length > 0) {
    for (const st of Object.values(modules)) {
      if (st) rollup = worst(rollup, st);
    }
  }

  const rollupLabel =
    rollup === 'critical' ? t('rollupCritical') : rollup === 'degraded' ? t('rollupDegraded') : t('rollupOk');

  const RollupIcon = rollup === 'critical' ? XCircle : rollup === 'degraded' ? AlertTriangle : CheckCircle2;
  const rollupClass =
    rollup === 'critical'
      ? 'border-red-500/40 bg-red-950/35 text-red-100'
      : rollup === 'degraded'
        ? 'border-amber-500/35 bg-amber-950/25 text-amber-100'
        : 'border-emerald-500/35 bg-emerald-950/20 text-emerald-100';

  function moduleDot(key: ModuleKey): 'ok' | 'degraded' | 'critical' | 'loading' {
    if (modulesLoading || !modules) return 'loading';
    const s = modules[key];
    return s ?? 'degraded';
  }

  const healthChecked = health?.checked_at ?? null;
  const relativeOps = useMemo(
    () => formatCheckedAtRelative(opsCheckedAt, locale),
    // tick: recompute relative wording every 10s
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick intentionally invalidates
    [opsCheckedAt, locale, tick],
  );
  const relativeHealthIntegrations = useMemo(
    () => formatCheckedAtRelative(healthChecked, locale),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick intentionally invalidates
    [healthChecked, locale, tick],
  );

  const svcLabel = useCallback(
    (name: string) => {
      const k = `svc_${name}`;
      if (
        ['svc_database', 'svc_openai', 'svc_anthropic', 'svc_whatsapp', 'svc_webhooks'].includes(k)
      ) {
        return t(k as 'svc_database');
      }
      return name;
    },
    [t],
  );

  const dotTitles = useMemo(
    () => ({
      ok: t('dotOk'),
      warn: t('dotWarn'),
      problem: t('dotProblem'),
    }),
    [t],
  );

  return (
    <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/45 px-4 py-3 sm:px-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${rollupClass}`}>
          <RollupIcon className="w-4 h-4 shrink-0 opacity-90" />
          <span>{t('synthLabel', { label: rollupLabel })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => void load({ allowHidden: true })}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/90 bg-zinc-900/80 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            title={t('refreshTitle')}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {t('refreshBtn')}
          </button>
          <p className="text-[10px] text-zinc-600 font-mono leading-relaxed max-w-xl text-right">
            {t('modulesLine', { relative: relativeOps || t('emDash') })}
            {healthChecked ? (
              <span className="block text-zinc-700">
                {t('integrationsLine', { relative: relativeHealthIntegrations })}
              </span>
            ) : null}
            <span className="block text-zinc-700 mt-0.5">{t('hintLine')}</span>
          </p>
        </div>
      </div>

      {err ? (
        <p className="text-[11px] text-red-400/90">
          {t('healthErrPrefix')} {err}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {(health?.services ?? []).map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <Dot
              status={s.status}
              titleOk={dotTitles.ok}
              titleWarn={dotTitles.warn}
              titleProblem={dotTitles.problem}
            />
            <span className="font-mono">{svcLabel(s.name)}</span>
          </div>
        ))}
        {loading && !health ? (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Dot
              status={DOT_STATUS_LOADING}
              titleOk={dotTitles.ok}
              titleWarn={dotTitles.warn}
              titleProblem={dotTitles.problem}
            />
            {t('loadingDots')}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 border-l border-zinc-800 pl-3 sm:pl-4">
          <Dot
            status={vaultStatus}
            titleOk={dotTitles.ok}
            titleWarn={dotTitles.warn}
            titleProblem={dotTitles.problem}
          />
          <span className="font-mono">{t('vaultS3')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Dot
            status={guardianDot}
            titleOk={dotTitles.ok}
            titleWarn={dotTitles.warn}
            titleProblem={dotTitles.problem}
          />
          <span className="font-mono">{t('guardian')}</span>
          {pendingGuardianDrafts > 0 ? (
            <span className="text-amber-400/90">{t('draftsCount', { count: pendingGuardianDrafts })}</span>
          ) : null}
        </div>
      </div>

      <div className="border-t border-zinc-800/80 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{t('modulesSectionTitle')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ADMIN_MODULE_DEFS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              title={[t(MOD_BLURB_KEYS[m.moduleKey]), moduleHints?.[m.moduleKey]].filter(Boolean).join('\n\n')}
              className="group flex items-start gap-2.5 rounded-xl border border-zinc-800/70 bg-zinc-950/35 px-3 py-2.5 text-left transition-colors hover:border-zinc-700/80 hover:bg-zinc-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900/80"
            >
              <Dot
                status={moduleDot(m.moduleKey)}
                titleOk={dotTitles.ok}
                titleWarn={dotTitles.warn}
                titleProblem={dotTitles.problem}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-zinc-200 leading-tight flex items-center gap-1">
                  {t(MOD_TITLE_KEYS[m.moduleKey])}
                  <ChevronRight className="w-3 h-3 shrink-0 text-zinc-600 group-hover:text-amber-400/90 opacity-70" />
                </p>
                <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">{t(MOD_BLURB_KEYS[m.moduleKey])}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
