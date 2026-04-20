'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import {
  Activity,
  Archive,
  Clock,
  Download,
  Flame,
  Layers,
  LineChart,
  PieChartIcon,
  RefreshCw,
  Shield,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import { COHORT_RETENTION_FIELD } from '@/lib/admin/investor-metrics';
import type { InvestorMetricsPayload } from '@/lib/admin/investor-metrics';
import { investorOpenaiCostStatusMessage } from '@/lib/admin/investor-metrics';
import { buildInvestorReportPdfBlob, INVESTOR_EXPORT_SELECTORS } from '@/lib/admin/investor-report-pdf';
import { AdminInvestorCopilotBar } from '@/components/admin/admin-investor-metrics-chat-panel';
import { AdminInvestorSubscriberDirectory } from '@/components/admin/admin-investor-subscriber-directory';
import { AdminInvestorArchiveComparePanel } from '@/components/admin/admin-investor-archive-compare-panel';

const METRICS_POLL_MS = 15_000;

/** Clé de fenêtre « tout l’historique » (discriminant, pas une phrase UI). */
const BURN_WINDOW_KEY_ALL = 'all' as const;

const INV_CHART_AXIS_TICK = { fill: '#71717a', fontSize: 10 };
const INV_COHORT_X_AXIS_TICK = { ...INV_CHART_AXIS_TICK, fontSize: 9 };
const INV_CHART_AXIS_LINE = { stroke: '#3f3f46' };
const INV_PIE_LEGEND_WRAPPER_STYLE = { fontSize: 11, color: '#a1a1aa' } as const;

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm">
      {label != null && <p className="font-semibold text-zinc-200 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="text-zinc-400">
          <span className="text-zinc-500">{p.name} :</span>{' '}
          <span className="text-zinc-100 font-mono">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

type BurnWindow = 3 | 6 | 'all';

type InvestorArchiveRow = {
  id: string;
  created_at: string;
  file_name: string;
  byte_size: number;
  content_sha256: string;
  summary: Record<string, unknown> | null;
  metrics_generated_at: string | null;
};

export function AdminInvestorDashboardRoadmap() {
  const t = useTranslations('Admin.investorDashboardRoadmap');
  const format = useFormatter();
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [metrics, setMetrics] = useState<InvestorMetricsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [burnWindow, setBurnWindow] = useState<BurnWindow>(6);
  const [archives, setArchives] = useState<InvestorArchiveRow[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);

  const fetchArchives = useCallback(async () => {
    setArchivesLoading(true);
    try {
      const res = await fetch('/api/admin/investor-report-archive', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.archives)) {
        setArchives(data.archives as InvestorArchiveRow[]);
      }
    } finally {
      setArchivesLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/investor-metrics', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      setMetrics(data as InvestorMetricsPayload);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchMetrics();
    const poll = window.setInterval(fetchMetrics, METRICS_POLL_MS);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(id);
    };
  }, [fetchMetrics]);

  useEffect(() => {
    void fetchArchives();
  }, [fetchArchives]);

  /** Horloge uniquement après hydration — évite mismatch SSR/client sur toLocaleTimeString. */
  const liveClock = mounted
    ? new Date().toLocaleTimeString('fr-FR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const burnGrowthFiltered = useMemo(() => {
    const burnGrowthLive = metrics?.burnVsGrowth ?? [];
    if (burnWindow === 'all') return burnGrowthLive;
    return burnGrowthLive.slice(-burnWindow);
  }, [metrics?.burnVsGrowth, burnWindow]);
  const cohortLive = metrics?.cohorts ?? [];
  const planSlices = metrics?.planMix ?? [];

  const onExportPdf = async () => {
    if (!metrics) {
      toast.error(t('toastNoMetrics'));
      return;
    }
    setPdfBusy(true);
    const prevWindow = burnWindow;
    try {
      flushSync(() => setBurnWindow('all'));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 120));
      const blob = await buildInvestorReportPdfBlob(metrics);
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `REPUTEXA-Investor-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);

      const fd = new FormData();
      fd.append('file', blob, 'REPUTEXA-Investor-Report.pdf');
      fd.append('metrics', JSON.stringify(metrics));
      const archRes = await fetch('/api/admin/investor-report-archive', { method: 'POST', body: fd });
      const archData = await archRes.json().catch(() => ({}));
      if (!archRes.ok) {
        toast.message(t('toastPdfDownloadedArchivePendingTitle'), {
          description:
            typeof archData.error === 'string' ? archData.error : t('toastPdfArchiveStorageHint'),
        });
      } else {
        toast.success(t('toastPdfArchivedSuccess'));
        void fetchArchives();
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : t('toastPdfExportFailed'));
    } finally {
      flushSync(() => setBurnWindow(prevWindow));
      setPdfBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-zinc-950 overflow-hidden">
      <div className="border-b border-zinc-800/90 px-5 py-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 bg-zinc-900/60">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30">
            <LineChart className="w-5 h-5 text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 gap-y-1">
              <h2 className="text-sm font-bold text-white tracking-tight">{t('heroTitle')}</h2>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-200/80 border border-amber-500/25 rounded-md px-1.5 py-0.5 bg-amber-500/10">
                {t('badgeConfidential')}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono uppercase tracking-wider">
              {t('integrationsLine', { seconds: METRICS_POLL_MS / 1000 })}
            </p>
            <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-500/80 shrink-0" aria-hidden />
              {t('dueDiligenceFootnote')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400 shrink-0">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void fetchMetrics();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          <Clock className="w-3.5 h-3.5 text-amber-400/80" aria-hidden />
          <span className="tabular-nums text-amber-200/90 min-w-[5.5rem] inline-block" suppressHydrationWarning>
            {liveClock ?? t('clockPlaceholder')}
          </span>
          <span className="flex items-center gap-1 text-emerald-400/90">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            {t('liveIndicator')}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="min-w-0 flex flex-col gap-8">
        {loadError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {t('metricsError', { error: loadError })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-zinc-500">
          <span className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-0.5">
            {t('chipStripeUtc')}
          </span>
          <span className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-0.5">
            {t('chipZonesPdf', { count: Object.values(INVESTOR_EXPORT_SELECTORS).length })}
          </span>
          <span className="rounded-md border border-zinc-700/80 bg-zinc-900/50 px-2 py-0.5">
            {t('chipCopilotFpa')}
          </span>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-4xl">
          {t.rich('introPlainRich', {
            lead: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
            stripeTreasury: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            openaiEmail: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
            subscriptionList: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
          })}
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
            data-investor-export="live-cash"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              <Wallet className="w-4 h-4 text-emerald-400" />
              {t('liveCashCounterTitle')}
            </div>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              {t.rich('liveCashIntroRich', {
                stripeCash: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
                mrrLabel: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
              })}
            </p>
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-5 text-center">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                {t('stripeTreasuryTotalLabel')}
              </p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums text-emerald-400 tracking-tight">
                {metrics ? formatEur(metrics.stripe.totalCashEur) : loading ? '…' : '—'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-2">
                {t('stripeAvailPending', {
                  available: metrics ? formatEur(metrics.stripe.availableEur) : '—',
                  pending: metrics ? formatEur(metrics.stripe.pendingEur) : '—',
                })}
              </p>
              <p className="text-[10px] text-zinc-600 mt-3 uppercase tracking-wider">{t('mrrEstimatedLabel')}</p>
              <p className="text-lg font-semibold tabular-nums text-sky-300">
                {metrics ? formatEur(metrics.stripe.mrrEur) : '—'}
              </p>
              <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                {t('activeSubsTick', {
                  subs: metrics?.stripe.activeSubscriptions ?? '—',
                  tick,
                })}
              </p>
              {metrics?.saasKpis ? (
                <div className="mt-4 pt-4 border-t border-zinc-800 text-left space-y-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{t('saasKpiStripTitle')}</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{t('saasKpiStripIntro')}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wide">{t('saasKpiChurn')}</p>
                      <p className="font-mono text-zinc-200 tabular-nums">
                        {metrics.saasKpis.logoChurnMonthlyPct != null
                          ? `${metrics.saasKpis.logoChurnMonthlyPct.toFixed(2)}%`
                          : t('valueNotAvailable')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wide">{t('saasKpiArpu')}</p>
                      <p className="font-mono text-zinc-200 tabular-nums">
                        {metrics.saasKpis.arpuEur != null ? formatEur(metrics.saasKpis.arpuEur) : t('valueNotAvailable')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wide">{t('saasKpiLtv')}</p>
                      <p className="font-mono text-zinc-200 tabular-nums">
                        {metrics.saasKpis.estimatedLtvEur != null
                          ? formatEur(metrics.saasKpis.estimatedLtvEur)
                          : t('valueNotAvailable')}
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2 py-1.5">
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wide">{t('saasKpiCpa')}</p>
                      <p className="font-mono text-zinc-200 tabular-nums">
                        {metrics.saasKpis.cpaEur != null ? formatEur(metrics.saasKpis.cpaEur) : t('valueNotAvailable')}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {t('saasKpiNewMerchants', { count: metrics.saasKpis.newMerchantProfilesLast30d })}
                  </p>
                </div>
              ) : null}
              {metrics ? (
                <div className="mt-4 pt-4 border-t border-zinc-800 text-left space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider">
                    {t('subscriptionMarginLabel')}
                  </p>
                  <p
                    className={`text-xl font-bold tabular-nums ${
                      metrics.stripe.mrrEur - metrics.burnOps.totalEurMonth >= 0
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatEur(metrics.stripe.mrrEur - metrics.burnOps.totalEurMonth)}
                  </p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{t('variableCostsFootnote')}</p>
                  <p className="text-[10px] text-zinc-500 font-mono pt-1">
                    {t('burnMonthBase', { amount: formatEur(metrics.burnOps.totalEurMonth) })}
                    {metrics.burnOps.openaiError
                      ? t('burnMonthOpenaiCode', { code: metrics.burnOps.openaiError })
                      : null}
                  </p>
                  {investorOpenaiCostStatusMessage(metrics.burnOps.openaiError) ? (
                    <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-2 mt-2 leading-snug">
                      {investorOpenaiCostStatusMessage(metrics.burnOps.openaiError)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              <Activity className="w-4 h-4 text-sky-400" />
              {t('burnVsGrowthWindowTitle')}
            </div>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              {t.rich('burnFilterIntroRich', {
                utcMonths: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
              })}
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('burnChartWindowAria')}>
              {(
                [
                  { key: 3 as const, label: t('burnWindow3Months') },
                  { key: 6 as const, label: t('burnWindow6Months') },
                  { key: BURN_WINDOW_KEY_ALL, label: t('burnWindowAll') },
                ] as const
              ).map(({ key, label }) => {
                const active = burnWindow === key;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setBurnWindow(key)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                      active
                        ? 'border-amber-500/60 bg-amber-500/15 text-amber-100'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/80'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600">{t('burnGrowthFootnote')}</p>
          </div>
        </div>

        {metrics?.unitEconomics ? <AdminInvestorSubscriberDirectory unit={metrics.unitEconomics} /> : null}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wide">
            <LineChart className="w-4 h-4 text-orange-400" />
            {t('burnVsGrowthSectionTitle')}
          </div>
          <p className="text-[13px] text-zinc-500 leading-relaxed max-w-3xl">
            {t.rich('burnVsGrowthIntroRich', {
              growthLabel: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
              burnLabel: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            })}
          </p>
          <div className="h-[220px] w-full" data-investor-export="burn-chart">
            {mounted && burnGrowthFiltered.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burnGrowthFiltered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invBurn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="invGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="m" tick={INV_CHART_AXIS_TICK} axisLine={INV_CHART_AXIS_LINE} />
                  <YAxis tick={INV_CHART_AXIS_TICK} axisLine={INV_CHART_AXIS_LINE} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="burn"
                    name="Burn (k€)"
                    stroke="#f97316"
                    fill="url(#invBurn)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="growth"
                    name="Growth (k€)"
                    stroke="#34d399"
                    fill="url(#invGrowth)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                {loading ? t('burnChartLoading') : t('burnChartEmpty')}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-violet-500/20 bg-zinc-900/35 p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200 uppercase tracking-wide">
                <Download className="w-4 h-4 text-violet-400" />
                {t('dataRoomExportTitle')}
              </div>
              <p className="text-[13px] text-zinc-500 leading-relaxed">{t('dataRoomExportDescription')}</p>
              <p className="text-[11px] text-zinc-600">
                {t.rich('dataRoomBucketRich', {
                  bucket: (chunks) => <code className="text-zinc-500">{chunks}</code>,
                })}
              </p>
            </div>
            <button
              type="button"
              disabled={!metrics || pdfBusy}
              onClick={() => void onExportPdf()}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/45 bg-violet-600/25 px-5 py-3 text-xs font-semibold text-violet-50 hover:bg-violet-600/35 disabled:opacity-45 disabled:cursor-not-allowed shadow-lg shadow-violet-950/30"
            >
              <Download className="w-4 h-4" />
              {pdfBusy ? t('pdfExportGenerating') : t('pdfExportCta')}
            </button>
          </div>
          <div className="border-t border-zinc-800/90 pt-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              <Archive className="w-4 h-4 text-zinc-500" />
              {t('archivesSectionTitle')}
              {archivesLoading ? (
                <span className="text-zinc-600 font-normal normal-case">{t('archivesLoading')}</span>
              ) : null}
            </div>
            {archives.length === 0 && !archivesLoading ? (
              <p className="text-xs text-zinc-600">{t('archivesEmpty')}</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {archives.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="text-zinc-200 font-medium truncate" title={a.file_name}>
                        {a.file_name}
                      </p>
                      <p className="text-zinc-600 font-mono truncate">
                        {t('archiveRowMeta', {
                          date: format.dateTime(new Date(a.created_at), {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }),
                          sizeKb: (a.byte_size / 1024).toFixed(1),
                          hashTail: a.content_sha256.slice(-8),
                        })}
                      </p>
                    </div>
                    <a
                      href={`/api/admin/investor-report-archive/${a.id}/download`}
                      className="shrink-0 inline-flex items-center rounded-lg border border-zinc-600 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
                    >
                      {t('archiveDownload')}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <AdminInvestorArchiveComparePanel archives={archives} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              <Layers className="w-4 h-4 text-cyan-400" />
              {t('cohortSectionTitle')}
            </div>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              {t.rich('cohortIntroRich', {
                signupMonth: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
              })}
            </p>
            <div className="h-[200px] w-full" data-investor-export="cohort-chart">
              {mounted && cohortLive.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortLive} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="cohorte" tick={INV_COHORT_X_AXIS_TICK} axisLine={INV_CHART_AXIS_LINE} />
                    <YAxis
                      domain={[0, 100]}
                      tick={INV_CHART_AXIS_TICK}
                      axisLine={INV_CHART_AXIS_LINE}
                      unit="%"
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey={COHORT_RETENTION_FIELD}
                      name={t('cohortRetentionLabel')}
                      fill="#22d3ee"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-600 text-xs">—</div>
              )}
            </div>
            <p className="text-[10px] text-zinc-600">
              {t('cohortLastApiSync', { time: metrics?.generatedAt ?? '—' })}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wide">
              <PieChartIcon className="w-4 h-4 text-fuchsia-400" />
              {t('planMixSectionTitle')}
            </div>
            <p className="text-[13px] text-zinc-500 leading-relaxed">
              {t.rich('planMixIntroRich', {
                activeTrial: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
              })}
            </p>
            <div className="h-[220px] w-full flex items-center justify-center" data-investor-export="plan-pie">
              {mounted && planSlices.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planSlices}
                      dataKey="pct"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={84}
                      paddingAngle={2}
                      stroke="#18181b"
                      strokeWidth={2}
                      animationDuration={400}
                    >
                      {planSlices.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[11px] text-zinc-200">
                            {t('planPieTooltip', {
                              name: String(payload[0].payload.name),
                              pct: payload[0].value as number,
                              count: payload[0].payload.count as number,
                            })}
                          </div>
                        ) : null
                      }
                    />
                    <Legend
                      wrapperStyle={INV_PIE_LEGEND_WRAPPER_STYLE}
                      formatter={(value) => <span className="text-zinc-400">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-zinc-600 text-xs">—</div>
              )}
            </div>
            <p className="text-[10px] text-zinc-600 flex flex-wrap items-center gap-x-1 gap-y-1">
              <Flame className="w-3 h-3 text-orange-400 shrink-0" />
              {t('planMixBurnLine', {
                openai:
                  metrics?.burnOps.openaiEurMonth != null
                    ? formatEur(metrics.burnOps.openaiEurMonth)
                    : t('valueNotAvailable'),
                errorPart: metrics?.burnOps.openaiError
                  ? t('planMixOpenaiErrorSuffix', { code: metrics.burnOps.openaiError })
                  : '',
                resend: metrics ? formatEur(metrics.burnOps.resendEurMonth) : '—',
              })}
            </p>
            {metrics?.burnOps.openaiError && investorOpenaiCostStatusMessage(metrics.burnOps.openaiError) ? (
              <p className="text-[11px] text-amber-200/85 leading-snug">
                {investorOpenaiCostStatusMessage(metrics.burnOps.openaiError)}
              </p>
            ) : null}
          </div>
        </div>

        <AdminInvestorCopilotBar metrics={metrics} loading={loading} className="mt-2" />
        </div>
      </div>
    </section>
  );
}
