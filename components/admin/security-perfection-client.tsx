'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crosshair,
  Info,
  Loader2,
  Power,
  Skull,
  Sparkles,
  XCircle,
  Zap,
  Vault,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions, NumberFormatOptions } from 'use-intl';
import { Link } from '@/i18n/navigation';
import { AdminHelpPastille } from '@/components/admin/admin-help-pastille';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import type { OffensiveFinding } from '@/lib/admin/security-perfection-audit';
import type { SecurityPerfectionStored } from '@/lib/admin/security-perfection-state';
import type {
  SecurityAutonomousSchedule,
  SecurityAutonomousStored,
} from '@/lib/admin/security-autonomous-config';

type SentinelVaultLast = {
  run_at: string;
  status: string;
  error_message: string | null;
  s3_key_daily: string | null;
  s3_key_monthly: string | null;
  bytes_encrypted: number | null;
  duration_ms: number | null;
};

type SentinelVaultRunRow = {
  run_at: string;
  status: string;
  error_message: string | null;
  s3_key_daily: string | null;
  s3_key_monthly: string | null;
  bytes_plain: number | null;
  bytes_gzip: number | null;
  bytes_encrypted: number | null;
  duration_ms: number | null;
};

const VAULT_STALE_MS = 40 * 60 * 60 * 1000;

/** Intl options hoisted for ESLint (i18next/no-literal-string in JSX). */
const UTC_JOURNAL_ROW_DATETIME: DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const ACTIVITY_FEED_DATETIME: DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

const SENTINEL_OK_INLINE_DATETIME: DateTimeFormatOptions = {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const VAULT_STALE_INLINE_DATETIME: DateTimeFormatOptions = {
  timeZone: 'UTC',
  dateStyle: 'short',
  timeStyle: 'short',
};

const SHORT_MEDIUM_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

const SENTINEL_STATUS_DATETIME: DateTimeFormatOptions = {
  timeZone: 'UTC',
  dateStyle: 'medium',
  timeStyle: 'medium',
};

const MS_DURATION_UNIT: NumberFormatOptions = {
  style: 'unit',
  unit: 'millisecond',
};

const AUTONOMOUS_SCHEDULE_OPTIONS: readonly {
  value: SecurityAutonomousSchedule;
  labelKey:
    | 'scheduleOff'
    | 'scheduleHourly'
    | 'scheduleDaily'
    | 'scheduleIntensive';
  helpKey: 'scheduleOffHelp' | 'scheduleHourlyHelp' | 'scheduleDailyHelp' | 'scheduleIntensiveHelp';
}[] = [
  { value: 'off', labelKey: 'scheduleOff', helpKey: 'scheduleOffHelp' },
  { value: 'hourly', labelKey: 'scheduleHourly', helpKey: 'scheduleHourlyHelp' },
  { value: 'daily_random', labelKey: 'scheduleDaily', helpKey: 'scheduleDailyHelp' },
  { value: 'intensive_15m', labelKey: 'scheduleIntensive', helpKey: 'scheduleIntensiveHelp' },
];

const FINDING_SEVERITY_FILTER_ROWS = [
  ['all', 'filterAll'],
  ['critical', 'filterCritical'],
  ['warning', 'filterWarning'],
  ['info', 'filterInfo'],
] as const;

function formatUtcSlotMinutes(m: number | null, emDash: string): string {
  if (m == null || !Number.isFinite(m)) return emDash;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')} UTC`;
}

function severityIcon(sev: OffensiveFinding['severity']) {
  switch (sev) {
    case 'critical':
      return <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
    case 'info':
      return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    default:
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
  }
}

type SecurityPerfectionClientProps = {
  /** Dans l’overlay admin : pas de lien retour, espacements compacts */
  variant?: 'page' | 'overlay';
  /** Quand l’en-tête est rendu par la page (AdminSubpageHeader), masque titres dupliqués */
  pageChrome?: 'default' | 'external';
};

export function SecurityPerfectionClient({
  variant = 'page',
  pageChrome = 'default',
}: SecurityPerfectionClientProps) {
  const t = useTranslations('Dashboard.adminSecurityPerfection');
  const tRich = t.rich;
  const format = useFormatter();
  const [state, setState] = useState<SecurityPerfectionStored | null>(null);
  const [findings, setFindings] = useState<OffensiveFinding[]>([]);
  const [peerTip, setPeerTip] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [auto, setAuto] = useState<SecurityAutonomousStored | null>(null);
  const [autoLoading, setAutoLoading] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);
  const [ghostRunning, setGhostRunning] = useState(false);
  const [sentinelVault, setSentinelVault] = useState<SentinelVaultLast | null>(null);
  const [sentinelVaultHistory, setSentinelVaultHistory] = useState<SentinelVaultRunRow[]>([]);
  const [findingSevFilter, setFindingSevFilter] = useState<'all' | OffensiveFinding['severity']>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/security-perfection');
      const j = (await r.json()) as SecurityPerfectionStored & {
        error?: string;
        sentinelVault?: SentinelVaultLast | null;
        sentinelVaultHistory?: SentinelVaultRunRow[];
      };
      if (!r.ok) throw new Error(j.error ?? t('errLoad'));
      setSentinelVault(j.sentinelVault ?? null);
      setSentinelVaultHistory(
        Array.isArray(j.sentinelVaultHistory) ? j.sentinelVaultHistory : []
      );
      setState({
        godMode: j.godMode,
        killSwitch: j.killSwitch,
        healthScore: j.healthScore,
        lastScanAt: j.lastScanAt,
        activity: j.activity ?? [],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadAutonomous = useCallback(async () => {
    setAutoLoading(true);
    try {
      const r = await fetch('/api/admin/security-autonomous');
      const j = (await r.json()) as SecurityAutonomousStored & { error?: string };
      if (r.ok) setAuto(j);
      else setAuto(null);
    } catch {
      setAuto(null);
    } finally {
      setAutoLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAutonomous();
  }, [load, loadAutonomous]);

  const filteredOffensiveFindings = useMemo(() => {
    if (findingSevFilter === 'all') return findings;
    return findings.filter((f) => f.severity === findingSevFilter);
  }, [findings, findingSevFilter]);

  const patchAutonomous = async (patch: {
    schedule?: SecurityAutonomousSchedule;
    autoShield?: boolean;
  }) => {
    setAutoSaving(true);
    try {
      const r = await fetch('/api/admin/security-autonomous', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = (await r.json()) as SecurityAutonomousStored & { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('errGeneric'));
      setAuto(j);
      if (patch.schedule !== undefined) {
        toast.success(
          patch.schedule === 'off'
            ? t('toastAutoOff')
            : patch.schedule === 'intensive_15m'
              ? t('toastAutoIntensive')
              : patch.schedule === 'hourly'
                ? t('toastAutoHourly')
                : t('toastAutoDaily'),
        );
      }
      if (patch.autoShield !== undefined) {
        toast.success(patch.autoShield ? t('toastShieldOn') : t('toastShieldOff'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setAutoSaving(false);
    }
  };

  const runGhostMission = async () => {
    setGhostRunning(true);
    try {
      const r = await fetch('/api/admin/ghost-protocol', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = (await r.json()) as {
        skipped?: boolean;
        reason?: string;
        message?: string;
        state?: SecurityPerfectionStored;
        result?: { pillarLabel: string; layer: string; findings: unknown[]; nextPillarPreview: string };
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? t('ghostErr'));
      if (j.skipped) {
        toast.message(j.message ?? t('ghostSkipped'), { description: t('ghostSkippedDesc') });
        if (j.state) setState(j.state);
        return;
      }
      if (j.state) setState(j.state);
      if (j.result) {
        toast.success(t('ghostSuccess', { layer: j.result.layer, pillar: j.result.pillarLabel }), {
          description: t('ghostSuccessDesc', {
            next: j.result.nextPillarPreview,
            count: j.result.findings.length,
          }),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setGhostRunning(false);
    }
  };

  const runScan = async () => {
    setScanning(true);
    setFindings([]);
    setPeerTip('');
    try {
      const r = await fetch('/api/admin/security-perfection/scan', { method: 'POST' });
      const j = (await r.json()) as {
        skipped?: boolean;
        reason?: string;
        message?: string;
        audit?: { findings: OffensiveFinding[]; peerTip: string; healthScore: number };
        state?: SecurityPerfectionStored;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? t('scanErr'));
      if (j.skipped) {
        toast.message(j.message ?? t('scanSkipped'), { description: t('scanSkippedDesc') });
        if (j.state) setState(j.state);
        return;
      }
      if (j.state) setState(j.state);
      if (j.audit) {
        setFindings(j.audit.findings);
        setPeerTip(j.audit.peerTip);
        toast.success(t('scanSuccess', { score: j.audit.healthScore }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setScanning(false);
    }
  };

  const patchState = async (patch: Partial<Pick<SecurityPerfectionStored, 'godMode' | 'killSwitch'>>) => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/security-perfection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = (await r.json()) as SecurityPerfectionStored & { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('errGeneric'));
      setState(j);
      toast.success(t('settingsSaved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !state) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  const score = state.healthScore;

  const isOverlay = variant === 'overlay';
  const showInlinePageChrome = !isOverlay && pageChrome !== 'external';

  const vaultBanner = (() => {
    if (!sentinelVault) return null;
    if (sentinelVault.status === 'failed') {
      return {
        tone: 'danger' as const,
        title: t('vaultFailedTitle'),
        body: sentinelVault.error_message?.slice(0, 280) || t('vaultFailedBodyDefault'),
      };
    }
    if (sentinelVault.status === 'running') {
      return {
        tone: 'warn' as const,
        title: t('vaultRunningTitle'),
        body: t('vaultRunningBody'),
      };
    }
    if (sentinelVault.status === 'ok' && sentinelVault.run_at) {
      const age = Date.now() - new Date(sentinelVault.run_at).getTime();
      if (age > VAULT_STALE_MS) {
        return {
          tone: 'warn' as const,
          title: t('vaultStaleTitle'),
          body: t('vaultStaleBody', {
            date: format.dateTime(new Date(sentinelVault.run_at), VAULT_STALE_INLINE_DATETIME),
          }),
        };
      }
    }
    return null;
  })();

  return (
    <div className={`max-w-4xl mx-auto ${isOverlay ? 'space-y-5' : 'space-y-8'}`}>
      {showInlinePageChrome ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('backAdmin')}
          </Link>
          <Link
            href="/dashboard/admin/code-guardian"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-indigo-300/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35"
          >
            {t('linkCodeGuardian')}
          </Link>
        </div>
      ) : null}

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          {showInlinePageChrome ? (
            <>
              <div className="flex items-center gap-2">
                <Crosshair className="w-6 h-6 text-rose-400" />
                <h1 className="text-xl font-bold text-white tracking-tight">{t('pageTitle')}</h1>
              </div>
              <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-xl">
                {tRich('pageSubtitleRich', {
                  hl: (chunks) => <span className="text-zinc-400">{chunks}</span>,
                })}
              </p>
            </>
          ) : !isOverlay ? null : (
            <p className="text-[11px] text-zinc-500 leading-relaxed max-w-xl">{t('overlayNote')}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-4 py-3 min-w-[5.5rem] ${
              score >= 85
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : score >= 60
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-red-500/50 bg-red-500/10'
            }`}
          >
            <span className="text-2xl font-black tabular-nums text-white leading-none">{score}</span>
            <span className="text-[10px] font-semibold text-zinc-400 tabular-nums leading-none">{t('scoreOutOf')}</span>
          </div>
        </div>
      </header>

      {!isOverlay ? (
        <AdminGuidePanel title={t('guidePanelTitle')}>
          <div className="space-y-3">
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideWhatTitle')}</h3>
              <p>
                {tRich('guideWhatBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideScoreTitle')}</h3>
              <p>
                {tRich('guideScoreBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideKillTitle')}</h3>
              <p>
                {tRich('guideKillBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideGodTitle')}</h3>
              <p>
                {tRich('guideGodBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideVaultTitle')}</h3>
              <p>
                {tRich('guideVaultBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideRobotTitle')}</h3>
              <p>
                {tRich('guideRobotBodyRich', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
          </div>
        </AdminGuidePanel>
      ) : null}

      {state.killSwitch ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 flex gap-3 items-start">
          <Skull className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-200">{t('killBannerTitle')}</p>
            <p className="text-xs text-red-300/80 mt-0.5">{t('killBannerBody')}</p>
          </div>
        </div>
      ) : null}

      {vaultBanner ? (
        <div
          className={`rounded-xl border px-4 py-3 flex gap-3 items-start ${
            vaultBanner.tone === 'danger'
              ? 'border-red-500/50 bg-red-950/40'
              : 'border-amber-500/45 bg-amber-950/25'
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              vaultBanner.tone === 'danger' ? 'text-red-400' : 'text-amber-400'
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                vaultBanner.tone === 'danger' ? 'text-red-100' : 'text-amber-100'
              }`}
            >
              {vaultBanner.title}
            </p>
            <p
              className={`text-xs mt-0.5 leading-relaxed ${
                vaultBanner.tone === 'danger' ? 'text-red-200/85' : 'text-amber-200/85'
              }`}
            >
              {vaultBanner.body}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest inline-flex items-center">
              {t('killCardTitle')}
              <AdminHelpPastille text={t('killHelpPastille')} />
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('killCardDesc')}</p>
          <button
            type="button"
            disabled={saving}
            title={state.killSwitch ? t('killTitleOn') : t('killTitleOff')}
            onClick={() => void patchState({ killSwitch: !state.killSwitch })}
            className={`w-full rounded-lg py-2.5 text-xs font-bold transition-colors ${
              state.killSwitch
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-600'
                : 'bg-red-600/90 text-white hover:bg-red-500'
            }`}
          >
            {state.killSwitch ? t('killBtnOn') : t('killBtnOff')}
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest inline-flex items-center">
              {t('godCardTitle')}
              <AdminHelpPastille text={t('godHelpPastille')} />
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {tRich('godCardDescRich', {
              hl: (chunks) => <strong className="text-zinc-400 font-medium">{chunks}</strong>,
            })}
          </p>
          <button
            type="button"
            disabled={saving || state.killSwitch}
            title={
              state.killSwitch
                ? t('godTitleKillFirst')
                : state.godMode
                  ? t('godTitleGodOff')
                  : t('godTitleGodOn')
            }
            onClick={() => void patchState({ godMode: !state.godMode })}
            className={`w-full rounded-lg py-2.5 text-xs font-bold transition-colors disabled:opacity-40 ${
              state.godMode
                ? 'bg-violet-600 text-white hover:bg-violet-500'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-600'
            }`}
          >
            {state.godMode ? t('godBtnOn') : t('godBtnOff')}
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-indigo-500/25 bg-indigo-950/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-bold text-indigo-200 uppercase tracking-widest">{t('robotSectionTitle')}</h2>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {tRich('robotIntroRich', {
            hl: (chunks) => <span className="text-indigo-200/90 font-semibold">{chunks}</span>,
            hl2: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            hl3: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
          })}
        </p>
        {autoLoading || !auto ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('robotLoading')}
          </div>
        ) : (
          <>
            {auto.schedule === 'daily_random' && auto.dailyRandomSlotMinutesUtc != null ? (
              <p className="text-[11px] text-indigo-300/90 font-mono">
                {t('robotSlotLine', {
                  slot: formatUtcSlotMinutes(auto.dailyRandomSlotMinutesUtc, t('emDash')),
                  last: auto.lastRandomAuditAt
                    ? format.dateTime(new Date(auto.lastRandomAuditAt), SHORT_MEDIUM_DATETIME)
                    : t('robotLastRunNever'),
                })}
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 font-mono">
                {t('robotLastRunLine', {
                  last: auto.lastRandomAuditAt
                    ? format.dateTime(new Date(auto.lastRandomAuditAt), SHORT_MEDIUM_DATETIME)
                    : t('emDash'),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {AUTONOMOUS_SCHEDULE_OPTIONS.map(({ value, labelKey, helpKey }) => (
                <button
                  key={value}
                  type="button"
                  title={t(helpKey)}
                  disabled={autoSaving || state.killSwitch}
                  onClick={() => void patchAutonomous({ schedule: value })}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
                    auto.schedule === value
                      ? 'border-indigo-500/60 bg-indigo-600/30 text-indigo-100'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-indigo-500/25 bg-zinc-900/40 px-3 py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-indigo-100/90">{t('shieldTitle')}</span>
                <button
                  type="button"
                  title={t('shieldToggleHelp')}
                  disabled={autoSaving || state.killSwitch}
                  onClick={() => void patchAutonomous({ autoShield: !auto.autoShield })}
                  className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                    auto.autoShield
                      ? 'border-emerald-500/50 bg-emerald-600/25 text-emerald-100'
                      : 'border-zinc-600 bg-zinc-800/80 text-zinc-400'
                  }`}
                >
                  {auto.autoShield ? t('shieldOn') : t('shieldOff')}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{t('shieldDesc')}</p>
            </div>
            <p className="text-[10px] text-zinc-600">
              {tRich('cronNoteRich', {
                hl: (chunks) => <strong className="text-zinc-500">{chunks}</strong>,
              })}
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Vault className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold text-emerald-200 uppercase tracking-widest inline-flex items-center gap-1">
            {t('sentinelTitle')}
            <AdminHelpPastille text={t('sentinelHelpPastille')} />
          </h2>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {tRich('sentinelIntroRich', {
            hl: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            mono: (chunks) => <code className="text-zinc-400">{chunks}</code>,
          })}
        </p>
        <div className="rounded-xl border border-emerald-500/20 bg-zinc-900/40 px-3 py-2.5 flex flex-wrap items-center gap-2">
          {!sentinelVault ? (
            <span className="text-xs text-zinc-500">{t('sentinelNoTrace')}</span>
          ) : sentinelVault.status === 'ok' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" title={t('titleOk')} />
              <span className="text-xs text-emerald-100/95">
                {tRich('sentinelOkRich', {
                  date: () => (
                    <span className="font-mono text-emerald-200">
                      {format.dateTime(new Date(sentinelVault.run_at), SENTINEL_OK_INLINE_DATETIME)}
                    </span>
                  ),
                })}
              </span>
              {sentinelVault.s3_key_daily ? (
                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-full block sm:inline sm:max-w-[280px]">
                  {sentinelVault.s3_key_daily}
                </span>
              ) : null}
            </>
          ) : sentinelVault.status === 'failed' ? (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-xs text-red-200">
                {t('sentinelFailedLine', {
                  date: format.dateTime(new Date(sentinelVault.run_at), SENTINEL_STATUS_DATETIME),
                  error: sentinelVault.error_message || t('emDash'),
                })}
              </span>
            </>
          ) : (
            <span className="text-xs text-amber-200/90">
              {t('sentinelOtherLine', {
                status: sentinelVault.status,
                date: format.dateTime(new Date(sentinelVault.run_at), SENTINEL_STATUS_DATETIME),
              })}
            </span>
          )}
        </div>
        {sentinelVaultHistory.length > 0 ? (
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/40 overflow-hidden">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-3 py-2 border-b border-zinc-800">
              {t('journalTitle')}
            </p>
            <div className="max-h-[220px] overflow-auto text-[10px] font-mono">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold">{t('thUtc')}</th>
                    <th className="px-2 py-1.5 font-semibold">{t('thStatus')}</th>
                    <th className="px-2 py-1.5 font-semibold">{t('thSizes')}</th>
                    <th className="px-2 py-1.5 font-semibold">{t('thS3Key')}</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400 divide-y divide-zinc-800/80">
                  {sentinelVaultHistory.map((row, idx) => (
                    <tr key={`${row.run_at}-${idx}`}>
                      <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500">
                        {format.dateTime(new Date(row.run_at), UTC_JOURNAL_ROW_DATETIME)}
                      </td>
                      <td
                        className={`px-2 py-1.5 font-semibold ${
                          row.status === 'ok'
                            ? 'text-emerald-400'
                            : row.status === 'failed'
                              ? 'text-red-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {row.status}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                        {row.bytes_plain != null
                          ? `${format.number(row.bytes_plain)} ${t('unitPlain')}`
                          : t('emDash')}
                        {row.bytes_gzip != null
                          ? ` · ${format.number(row.bytes_gzip)} ${t('unitGz')}`
                          : ''}
                        {row.bytes_encrypted != null
                          ? ` · ${format.number(row.bytes_encrypted)} ${t('unitEnc')}`
                          : ''}
                        {row.duration_ms != null
                          ? ` · ${format.number(row.duration_ms, MS_DURATION_UNIT)}`
                          : ''}
                      </td>
                      <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.s3_key_daily ?? ''}>
                        {row.s3_key_daily ?? (row.error_message ? row.error_message.slice(0, 48) : t('emDash'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div
        className="rounded-xl border border-zinc-600/45 bg-zinc-950/85 px-4 py-3.5 shadow-sm"
        role="note"
      >
        <p className="text-[11px] leading-relaxed text-zinc-400">
          <span className="select-none mr-1.5" aria-hidden>
            💡
          </span>
          {tRich('ipNoteRich', {
            lead: (chunks) => <span className="text-zinc-200/90 font-medium">{chunks}</span>,
            hl: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            mono: (chunks) => (
              <code className="rounded border border-zinc-700/80 bg-zinc-900/80 px-1 py-0.5 text-[10px] font-mono text-zinc-400">
                {chunks}
              </code>
            ),
          })}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <button
          type="button"
          disabled={ghostRunning || state.killSwitch}
          title={t('ghostBtnHelp')}
          onClick={() => void runGhostMission()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-3"
        >
          {ghostRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {t('ghostBtn')}
        </button>
        <button
          type="button"
          disabled={scanning || state.killSwitch}
          title={t('scanBtnHelp')}
          onClick={() => void runScan()}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-3"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {t('scanBtn')}
        </button>
        {state.lastScanAt ? (
          <span className="text-[11px] text-zinc-600 font-mono">
            {t('lastScan', {
              date: format.dateTime(new Date(state.lastScanAt), SHORT_MEDIUM_DATETIME),
            })}
          </span>
        ) : null}
      </div>

      {peerTip ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 px-4 py-3 flex gap-2">
          <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-200/90 leading-relaxed">{peerTip}</p>
        </div>
      ) : null}

      {findings.length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t('findingsTitle')}</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FINDING_SEVERITY_FILTER_ROWS.map(([key, labelKey]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFindingSevFilter(key)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  findingSevFilter === key
                    ? 'bg-rose-600/35 text-rose-100 border border-rose-400/40'
                    : 'bg-zinc-900/50 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {filteredOffensiveFindings.length === 0 ? (
            <p className="text-xs text-amber-400/90 mb-2">{t('filterEmpty')}</p>
          ) : null}
          <ul className="space-y-2">
            {filteredOffensiveFindings.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 flex gap-3"
              >
                {severityIcon(f.severity)}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-200">{f.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{f.detail}</p>
                  <span className="inline-block mt-2 text-[10px] font-mono text-zinc-600 uppercase">
                    {f.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t('activityTitle')}</h2>
        <div className="rounded-2xl border border-zinc-800 divide-y divide-zinc-800/80 max-h-[360px] overflow-y-auto">
          {state.activity.length === 0 ? (
            <p className="text-center text-xs text-zinc-600 py-10">{t('activityEmpty')}</p>
          ) : (
            [...state.activity].reverse().map((a, i) => (
              <div key={`${a.at}-${i}`} className="px-4 py-2.5 text-[11px]">
                <span className="text-zinc-600 font-mono mr-2">
                  {format.dateTime(new Date(a.at), ACTIVITY_FEED_DATETIME)}
                </span>
                <span
                  className={`font-semibold mr-2 uppercase text-[10px] ${
                    a.kind === 'kill' || a.kind === 'vault_fail'
                      ? 'text-red-400'
                      : a.kind === 'god'
                        ? 'text-violet-400'
                        : a.kind === 'ghost'
                          ? 'text-indigo-400'
                          : a.kind === 'scan' || a.kind === 'vault_ok'
                            ? 'text-emerald-400'
                            : 'text-zinc-500'
                  }`}
                >
                  {a.kind}
                </span>
                <span className="text-zinc-400">{a.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="text-[10px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-6">
        {tRich('footerRich', {
          hl: (chunks) => <strong className="text-zinc-500">{chunks}</strong>,
        })}
      </p>
    </div>
  );
}
