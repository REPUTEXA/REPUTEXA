'use client';

import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  Info,
  Loader2,
  MapPin,
  Radar,
  Radio,
  Shield,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type {
  Sentinel360AuditReport,
  Sentinel360AutoFrequency,
  SentinelFinding,
} from '@/lib/admin/sentinel-360-audit';
import type { GrandCentralStatusPayload } from '@/lib/admin/grand-central-status';
import { AdminModalPortal } from '@/components/admin/admin-modal-portal';

const PHASE_CONFIG = [
  { key: 'legal', labelKey: 'phaseLegal' as const },
  { key: 'compliance', labelKey: 'phaseCompliance' as const },
  { key: 'consistency', labelKey: 'phaseConsistency' as const },
  { key: 'payment', labelKey: 'phasePayment' as const },
] as const;

/** Hoisted pour ESLint (i18next/no-literal-string dans le JSX). */
const SENTINEL_SCHEDULE_BUTTONS = [
  ['off', 'scheduleOff'],
  ['daily', 'scheduleDaily'],
  ['weekly', 'scheduleWeekly'],
] as const;

const CODE_INLINE =
  'rounded bg-zinc-900/80 px-1 py-px text-[9px] font-mono text-zinc-400 border border-zinc-800/80';

function severityIcon(sev: SentinelFinding['severity']) {
  switch (sev) {
    case 'critical':
      return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'info':
      return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    default:
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
}

export function Sentinel360FlashTrigger() {
  const t = useTranslations('Admin.sentinel360');
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<Sentinel360AuditReport | null>(null);
  const [freq, setFreq] = useState<Sentinel360AutoFrequency>('off');
  const [freqLoading, setFreqLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState<string | null>(null);
  const [phaseProg, setPhaseProg] = useState<Record<string, number>>({});
  const [fortress, setFortress] = useState<GrandCentralStatusPayload | null | undefined>(undefined);

  const loadFortressStatus = useCallback(async () => {
    setFortress(undefined);
    try {
      const r = await fetch('/api/admin/grand-central-status', { cache: 'no-store' });
      const j = (await r.json()) as GrandCentralStatusPayload & { error?: string };
      if (!r.ok) {
        setFortress(null);
        return;
      }
      setFortress({
        ipFilterActive: Boolean(j.ipFilterActive),
        browserBindActive: Boolean(j.browserBindActive),
        gatewayReady: Boolean(j.gatewayReady),
      });
    } catch {
      setFortress(null);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/sentinel-360/schedule');
      const j = (await r.json()) as { autoFrequency?: Sentinel360AutoFrequency };
      if (r.ok && j.autoFrequency) setFreq(j.autoFrequency);
    } catch {
      /* ignore */
    }
  }, []);

  const runScan = async () => {
    setScanning(true);
    setReport(null);
    setPhaseProg(Object.fromEntries(PHASE_CONFIG.map((p, i) => [p.key, (i + 1) * 15])));
    try {
      const res = await fetch('/api/admin/sentinel-360/scan', { method: 'POST' });
      const json = (await res.json()) as Sentinel360AuditReport & { error?: string };
      if (!res.ok) throw new Error(json.error ?? t('errScanFailed'));
      setReport(json);
      setPhaseProg(Object.fromEntries(PHASE_CONFIG.map((p) => [p.key, 100])));
      toast.success(t('toastScanDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastScanError'));
      setPhaseProg({});
    } finally {
      setScanning(false);
    }
  };

  const onOpen = () => {
    setOpen(true);
    void loadSchedule();
    void loadFortressStatus();
    setReport(null);
  };

  const saveSchedule = async (next: Sentinel360AutoFrequency) => {
    setFreqLoading(true);
    try {
      const res = await fetch('/api/admin/sentinel-360/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoFrequency: next }),
      });
      const j = (await res.json()) as { error?: string; autoFrequency?: Sentinel360AutoFrequency };
      if (!res.ok) throw new Error(j.error ?? t('errSchedule'));
      setFreq(j.autoFrequency ?? next);
      toast.success(
        next === 'off'
          ? t('toastScheduleOff')
          : next === 'daily'
            ? t('toastScheduleDaily')
            : t('toastScheduleWeekly')
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errSchedule'));
    } finally {
      setFreqLoading(false);
    }
  };

  const applyFix = async (fixId: string) => {
    if (fixId !== 'trigger_guardian') return;
    setApplyBusy(fixId);
    try {
      const res = await fetch('/api/admin/sentinel-360/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixId }),
      });
      const j = (await res.json()) as { error?: string; guardian?: { status?: string; summary?: string } };
      if (!res.ok) throw new Error(j.error ?? t('errApply'));
      toast.success(t('toastGuardian', { status: String(j.guardian?.status ?? 'ok') }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errSchedule'));
    } finally {
      setApplyBusy(null);
    }
  };

  const fortressRows = [
    {
      key: 'ip' as const,
      labelKey: 'ipFilteringLabel' as const,
      hintKey: 'ipFilteringHint' as const,
      Icon: MapPin,
      active: fortress?.ipFilterActive,
    },
    {
      key: 'bind' as const,
      labelKey: 'browserBindLabel' as const,
      hintKey: 'browserBindHint' as const,
      Icon: Fingerprint,
      active: fortress?.browserBindActive,
    },
    {
      key: 'gw' as const,
      labelKey: 'gatewayLabel' as const,
      hintKey: 'gatewayHint' as const,
      Icon: Radio,
      active: fortress?.gatewayReady,
    },
  ];

  const richCodeIp = {
    rich: (chunks: ReactNode) => <span className={CODE_INLINE}>{chunks}</span>,
  };

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/40 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        title={t('triggerTitle')}
      >
        <Radar className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
        <span className="hidden sm:inline">{t('triggerLabel')}</span>
      </button>

      {open ? (
        <AdminModalPortal>
          <div
            className="fixed inset-0 z-[9600] flex items-center justify-center p-3 sm:p-6"
            style={{
              paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-[10px] sm:backdrop-blur-xl"
              aria-label={t('closeAria')}
              onClick={() => setOpen(false)}
            />
            <div
              className="relative z-10 w-full sm:max-w-2xl max-h-[min(90dvh,calc(100dvh-1.5rem))] overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl flex flex-col shadow-black/50 ring-1 ring-white/5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sentinel-360-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 px-5 py-4 border-b border-zinc-800 bg-zinc-900/80">
                <div className="w-10 h-10 rounded-xl bg-violet-600/25 border border-violet-500/40 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-violet-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="sentinel-360-title" className="text-sm font-bold text-white tracking-tight">
                    {t('modalTitle')}
                  </h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{t('modalIntro')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                  aria-label={t('closeAria')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 space-y-3">
                  <p className="text-[10px] font-semibold text-sky-200/90 uppercase tracking-widest">
                    {t('fortressTitle')}
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {t.rich('fortressIntroRich', {
                      strong: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
                    })}
                  </p>
                  <ul className="space-y-2">
                    {fortressRows.map(({ key, labelKey, hintKey, Icon, active }) => {
                      const pending = fortress === undefined;
                      const on = active === true;
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5"
                        >
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              pending
                                ? 'border-zinc-700 bg-zinc-900'
                                : on
                                  ? 'border-emerald-500/40 bg-emerald-500/15'
                                  : 'border-zinc-700 bg-zinc-900/80'
                            }`}
                          >
                            {pending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                            ) : (
                              <Icon className={`w-3.5 h-3.5 ${on ? 'text-emerald-400' : 'text-zinc-500'}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-200">{t(labelKey)}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{t(hintKey)}</p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide tabular-nums ${
                              pending ? 'text-zinc-600' : on ? 'text-emerald-400' : 'text-zinc-500'
                            }`}
                          >
                            {pending ? t('statusPending') : t(on ? 'statusActive' : 'statusInactive')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 pt-3 border-t border-zinc-800/70">
                    <p className="flex gap-2 text-[10px] text-zinc-500/90 leading-relaxed">
                      <Info className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" aria-hidden />
                      <span>{t.rich('ipWarningRich', richCodeIp)}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                    {t('modulesTitle')}
                  </p>
                  {PHASE_CONFIG.map((p) => {
                    const pct = scanning ? Math.min(95, phaseProg[p.key] ?? 12) : report ? 100 : 8;
                    return (
                      <div key={p.key}>
                        <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                          <span>{t(p.labelKey)}</span>
                          <span className="font-mono tabular-nums">
                            {scanning ? `${pct}%` : report ? '100%' : t('progressIdle')}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              scanning ? 'bg-violet-500 animate-pulse' : report ? 'bg-emerald-500' : 'bg-zinc-700'
                            }`}
                            style={{ width: `${report ? 100 : scanning ? pct : 8}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => void runScan()}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5"
                  >
                    {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
                    {t('btnScan')}
                  </button>
                </div>

                {report ? (
                  <>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-[11px] text-zinc-400 flex flex-wrap gap-3">
                      <span className="text-red-400 font-semibold">
                        {t('criticalCount', { count: report.summaryCounts.critical })}
                      </span>
                      <span className="text-amber-400 font-semibold">
                        {t('warningCount', { count: report.summaryCounts.warning })}
                      </span>
                      <span className="text-sky-400 font-semibold">
                        {t('infoCount', { count: report.summaryCounts.info })}
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {t('okCount', { count: report.summaryCounts.ok })}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {report.findings.map((f) => (
                        <li
                          key={f.id}
                          className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5 flex gap-2"
                        >
                          <div className="pt-0.5">{severityIcon(f.severity)}</div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-200">{f.title}</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{f.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                        {t('fixesTitle')}
                      </p>
                      {report.fixProposals.map((fx) => (
                        <div
                          key={fx.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                              <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                              {fx.label}
                            </p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{fx.description}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {fx.clientRoute ? (
                              <Link
                                href={fx.clientRoute}
                                className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700"
                                onClick={() => setOpen(false)}
                              >
                                {t('btnOpen')}
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            ) : null}
                            {fx.action === 'trigger_guardian' ? (
                              <button
                                type="button"
                                disabled={!!applyBusy}
                                onClick={() => void applyFix(fx.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-600/90 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 text-[11px] font-semibold text-white"
                              >
                                {applyBusy === fx.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : null}
                                {t('btnExecute')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-emerald-400/90 uppercase tracking-widest">
                    {t('autoTitle')}
                  </p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {t.rich('autoBodyRich', {
                      rich: (chunks) => <code className="text-zinc-400">{chunks}</code>,
                    })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {SENTINEL_SCHEDULE_BUTTONS.map(([value, labelKey]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={freqLoading}
                        onClick={() => void saveSchedule(value)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold border transition-colors ${
                          freq === value
                            ? 'border-emerald-500/60 bg-emerald-600/25 text-emerald-100'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                    {freqLoading ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AdminModalPortal>
      ) : null}
    </>
  );
}
