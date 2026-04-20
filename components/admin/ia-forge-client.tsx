'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Brain,
  Check,
  ChevronRight,
  Clock,
  RefreshCw,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions, NumberFormatOptions } from 'use-intl';
import {
  IA_FORGE_LABELS,
  type IaForgeAgentKey,
  type IaForgeTrainingMode,
} from '@/lib/admin/ia-forge-constants';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { AdminToolbarButton } from '@/components/admin/admin-toolbar-button';

type ScoreBlock = {
  accuracyPct: number | null;
  conversionPct: number | null;
  repairAvgMinutes: number | null;
  relevancePct: number | null;
};

type AgentPayload = {
  key: IaForgeAgentKey;
  label: string;
  trainingMode: IaForgeTrainingMode;
  scores: ScoreBlock;
  history: { day: string; relevance_pct: number | null }[];
};

type RlhfItem = {
  id: string;
  agent_key: string;
  title: string;
  context_text: string;
  ai_draft: string;
  status: string;
  created_at: string;
};

type ForgePayload = {
  agents: AgentPayload[];
  forgeSummary: string | null;
  rlhfPending: RlhfItem[];
  snippets: { id: string; agent_key: string; body: string; source: string; created_at: string }[];
  crossLearn: {
    id: string;
    source_agent: string;
    target_agent: string;
    pattern: string;
    notes: string;
    created_at: string;
  }[];
  /** ISO — renvoyé par l’API pour savoir quand les scores ont été calculés */
  fetchedAt?: string;
};

const MODE_I18N: Record<
  IaForgeTrainingMode,
  {
    labelKey: 'modeContinuousLabel' | 'modeBurstLabel' | 'modeDeepLabel';
    shortKey: 'modeContinuousShort' | 'modeBurstShort' | 'modeDeepShort';
    icon: typeof Zap;
  }
> = {
  continuous: { labelKey: 'modeContinuousLabel', shortKey: 'modeContinuousShort', icon: Zap },
  burst: { labelKey: 'modeBurstLabel', shortKey: 'modeBurstShort', icon: Clock },
  deep_dive: { labelKey: 'modeDeepLabel', shortKey: 'modeDeepShort', icon: Sparkles },
};

const IA_FORGE_TRAINING_MODES: IaForgeTrainingMode[] = ['continuous', 'burst', 'deep_dive'];

const PERCENT_SCORE: NumberFormatOptions = {
  style: 'percent',
  maximumFractionDigits: 0,
};

const MINUTE_UNIT: NumberFormatOptions = {
  style: 'unit',
  unit: 'minute',
};

const SNIPPET_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

const SERVER_LINE_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

const LINE_COLORS: Record<string, string> = {
  reputexa_core: '#a78bfa',
  babel: '#38bdf8',
  nexus: '#34d399',
  sentinel: '#fb923c',
  guardian: '#f472b6',
};

const RECHARTS_GRID_DASH = '3 3';
const RECHART_DATA_KEY_DAY = 'day';
const RECHART_AXIS_TICK_STYLE = { fill: '#71717a', fontSize: 10 };
const ANALYZE_DEPTH_BATCH = 'batch' as const;
const ANALYZE_DEPTH_DEEP = 'deep' as const;

function IaForgeChartTooltip({
  active,
  label,
  payload,
  format,
  t,
}: {
  active?: boolean;
  label?: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  format: ReturnType<typeof useFormatter>;
  t: (key: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-[11px] shadow-xl">
      {label != null && label !== '' && (
        <p className="font-semibold text-zinc-200 mb-1">{String(label)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="text-zinc-400">
          <span className="text-zinc-500">{p.name}:</span>{' '}
          <span className="text-cyan-200 font-mono">
            {p.value != null && typeof p.value === 'number'
              ? format.number(p.value / 100, PERCENT_SCORE)
              : t('chartTooltipDash')}
          </span>
        </p>
      ))}
    </div>
  );
}

export function IaForgeClient() {
  const tForge = useTranslations('Dashboard.adminIaForgeClient');
  const tRich = tForge.rich;
  const format = useFormatter();
  const [data, setData] = useState<ForgePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<string | null>(null);
  const [correctionById, setCorrectionById] = useState<Record<string, string>>({});
  const [deepCorpus, setDeepCorpus] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ia-forge', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
      }
      setData(j as ForgePayload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tForge('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [tForge]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || busyMode !== null) return;
      void load();
    }, 120_000);
    return () => window.clearInterval(t);
  }, [load, busyMode]);

  const chartData = useMemo(() => {
    if (!data?.agents.length) return [];
    const days = new Set<string>();
    for (const a of data.agents) {
      for (const h of a.history) {
        if (h.day) days.add(h.day);
      }
    }
    const sorted = [...days].sort();
    return sorted.map((day) => {
      const row: Record<string, string | number | null> = { day: day.slice(5) };
      for (const a of data.agents) {
        const pt = a.history.find((x) => x.day === day);
        row[a.key] = pt?.relevance_pct ?? null;
      }
      return row;
    });
  }, [data]);

  const setTrainingMode = async (agentKey: IaForgeAgentKey, trainingMode: IaForgeTrainingMode) => {
    setBusyMode(`${agentKey}-${trainingMode}`);
    try {
      const res = await fetch('/api/admin/ia-forge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentKey, trainingMode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : tForge('errGeneric'));
      toast.success(
        tForge('toastModeSet', {
          short: tForge(MODE_I18N[trainingMode].shortKey),
          agent: IA_FORGE_LABELS[agentKey],
        }),
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tForge('errUpdate'));
    } finally {
      setBusyMode(null);
    }
  };

  const runSnapshot = async () => {
    setBusyMode('snapshot');
    try {
      const res = await fetch('/api/admin/ia-forge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : tForge('errGeneric'));
      toast.success(tForge('toastSnapshotOk', { day: String(j.day ?? '') }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tForge('toastSnapshotFail'));
    } finally {
      setBusyMode(null);
    }
  };

  const runAnalyze = async (depth: 'batch' | 'deep') => {
    setBusyMode(`analyze-${depth}`);
    try {
      const res = await fetch('/api/admin/ia-forge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depth,
          extraCorpus: depth === 'deep' ? deepCorpus : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : tForge('errGeneric'));
      toast.success(
        tForge('toastAnalyzeOk', {
          depth: tForge(depth === 'batch' ? 'depthBatch' : 'depthDeep'),
          snippets: j.insertedSnippets ?? 0,
          cross: j.crossLearnInserted ?? 0,
        }),
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tForge('toastAnalyzeFail'));
    } finally {
      setBusyMode(null);
    }
  };

  const seedRlhf = async () => {
    setBusyMode('rlhf-seed');
    try {
      const res = await fetch('/api/admin/ia-forge/rlhf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : tForge('errGeneric'));
      toast.success(tForge('toastRlhfSeed', { count: j.inserted ?? 0 }));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tForge('toastRlhfSeedFail'));
    } finally {
      setBusyMode(null);
    }
  };

  const resolveRlhf = async (id: string, action: 'validate' | 'correct') => {
    setBusyMode(`rlhf-${id}`);
    try {
      const correction = (correctionById[id] ?? '').trim();
      const res = await fetch('/api/admin/ia-forge/rlhf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id,
          correction: action === 'correct' ? correction : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : tForge('errGeneric'));
      toast.success(action === 'validate' ? tForge('toastValidateOk') : tForge('toastCorrectOk'));
      setCorrectionById((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tForge('toastRlhfActionFail'));
    } finally {
      setBusyMode(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        {tForge('loadingTitle')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <p className="text-red-400 text-sm mb-2">{error ?? tForge('errStateTitle')}</p>
        <p className="text-zinc-600 text-xs mb-4">
          {tRich('errStateHintRich', {
            mono: (chunks) => <code className="text-zinc-500">{chunks}</code>,
          })}
        </p>
        <button
          type="button"
          onClick={() => load()}
          className="text-cyan-400 text-sm hover:underline"
        >
          {tForge('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-16">
      <div className="border-b border-zinc-800/40 bg-zinc-950/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {data.fetchedAt ? (
            <p className="text-[11px] font-mono text-zinc-600">
              {tForge('serverLine', {
                date: format.dateTime(new Date(data.fetchedAt), SERVER_LINE_DATETIME),
              })}
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminToolbarButton variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              {tForge('toolbarRefresh')}
            </AdminToolbarButton>
            <AdminToolbarButton variant="secondary" disabled={busyMode !== null} onClick={() => void runSnapshot()}>
              <Target className="h-3.5 w-3.5" />
              {tForge('toolbarSnapshot')}
            </AdminToolbarButton>
            <AdminToolbarButton
              variant="primary"
              disabled={busyMode !== null}
              onClick={() => void runAnalyze(ANALYZE_DEPTH_BATCH)}
            >
              <Brain className="h-3.5 w-3.5" />
              {tForge('toolbarBatch')}
            </AdminToolbarButton>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <AdminGuidePanel title={tForge('guidePanelTitle')}>
          <div className="space-y-3">
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {tForge('guideWhatTitle')}
              </h3>
              <p>
                {tRich('guideWhatBodyRich', {
                  b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {tForge('guideButtonsTitle')}
              </h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  {tRich('guideButtonsLi1Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideButtonsLi2Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideButtonsLi3Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
              </ul>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {tForge('guideSpeedsTitle')}
              </h3>
              <p>
                {tRich('guideSpeedsBodyRich', {
                  b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {tForge('guideRlhfTitle')}
              </h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  {tRich('guideRlhfLi1Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideRlhfLi2Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideRlhfLi3Rich', {
                    b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
              </ul>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {tForge('guideEmptyChartsTitle')}
              </h3>
              <p>
                {tRich('guideEmptyChartsBodyRich', {
                  b: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                })}
              </p>
            </section>
          </div>
        </AdminGuidePanel>

        {data.forgeSummary ? (
          <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-950/20 px-4 py-3 text-sm text-fuchsia-100/90">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-400/90">
              {tForge('forgeSummaryBadge')}
            </span>
            <p className="mt-1 text-zinc-200/95 leading-relaxed">{data.forgeSummary}</p>
          </div>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {tForge('chartSectionTitle')}
          </h2>
          {chartData.length < 2 ? (
            <p className="text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-xl p-6 text-center">
              {tRich('chartEmpty', {
                mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
              })}
            </p>
          ) : (
            <div className="h-72 w-full rounded-2xl border border-zinc-800 bg-zinc-900/40 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray={RECHARTS_GRID_DASH} stroke="#27272a" />
                  <XAxis dataKey={RECHART_DATA_KEY_DAY} tick={RECHART_AXIS_TICK_STYLE} />
                  <YAxis domain={[0, 100]} tick={RECHART_AXIS_TICK_STYLE} width={32} />
                  <Tooltip
                    content={(props) => (
                      <IaForgeChartTooltip {...props} format={format} t={tForge} />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.agents.map((a) => (
                    <Line
                      key={a.key}
                      type="monotone"
                      dataKey={a.key}
                      name={a.label}
                      stroke={LINE_COLORS[a.key] ?? '#a1a1aa'}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            {tForge('agentsSectionTitle')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.agents.map((a) => (
              <div
                key={a.key}
                className="rounded-2xl border border-zinc-800/90 bg-zinc-900/35 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{a.label}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{a.key}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400">
                    {tForge(MODE_I18N[a.trainingMode].shortKey)}
                  </span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5">
                    <p className="text-zinc-500 uppercase tracking-wide text-[10px]">{tForge('scoreAccuracy')}</p>
                    <p className="text-lg font-mono text-cyan-300 mt-0.5">
                      {a.scores.accuracyPct != null
                        ? format.number(a.scores.accuracyPct / 100, PERCENT_SCORE)
                        : tForge('chartTooltipDash')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5">
                    <p className="text-zinc-500 uppercase tracking-wide text-[10px]">{tForge('scoreConversion')}</p>
                    <p className="text-lg font-mono text-sky-300 mt-0.5">
                      {a.scores.conversionPct != null
                        ? format.number(a.scores.conversionPct / 100, PERCENT_SCORE)
                        : tForge('chartTooltipDash')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5">
                    <p className="text-zinc-500 uppercase tracking-wide text-[10px]">{tForge('scoreRepair')}</p>
                    <p className="text-lg font-mono text-orange-300 mt-0.5">
                      {a.scores.repairAvgMinutes != null
                        ? format.number(a.scores.repairAvgMinutes, MINUTE_UNIT)
                        : tForge('chartTooltipDash')}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 border border-violet-500/25 p-2.5">
                    <p className="text-violet-400/90 uppercase tracking-wide text-[10px]">{tForge('scoreRelevance')}</p>
                    <p className="text-lg font-mono text-violet-200 mt-0.5">
                      {a.scores.relevancePct != null
                        ? format.number(a.scores.relevancePct / 100, PERCENT_SCORE)
                        : tForge('chartTooltipDash')}
                    </p>
                  </div>
                </div>
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {IA_FORGE_TRAINING_MODES.map((m) => {
                    const M = MODE_I18N[m];
                    const Icon = M.icon;
                    const active = a.trainingMode === m;
                    const bkey = `${a.key}-${m}`;
                    return (
                      <button
                        key={m}
                        type="button"
                        disabled={busyMode !== null}
                        title={tForge(M.labelKey)}
                        onClick={() => setTrainingMode(a.key, m)}
                        className={
                          active
                            ? 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-100'
                            : 'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50'
                        }
                      >
                        <Icon className="w-3 h-3" />
                        {tForge(M.shortKey)}
                        {busyMode === bkey ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                {tForge('rlhfTitle')}
                <span className="text-[10px] font-normal text-zinc-500">{tForge('rlhfSubtitle')}</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">{tForge('rlhfIntro')}</p>
            </div>
            <button
              type="button"
              disabled={busyMode !== null}
              onClick={seedRlhf}
              className="text-xs px-3 py-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 disabled:opacity-50"
            >
              {tForge('rlhfSeedBtn')}
            </button>
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-800/80">
            {data.rlhfPending.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-zinc-600">{tForge('rlhfEmpty')}</p>
            ) : (
              data.rlhfPending.map((item) => (
                <div key={item.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {IA_FORGE_LABELS[item.agent_key as IaForgeAgentKey] ?? item.agent_key}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2">
                    {tForge('rlhfContextPrefix')} {item.context_text}
                  </p>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5 text-xs text-zinc-300 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {item.ai_draft}
                  </div>
                  <textarea
                    value={correctionById[item.id] ?? ''}
                    onChange={(e) =>
                      setCorrectionById((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder={tForge('placeholderCorrection')}
                    className="w-full min-h-[72px] rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 p-2 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyMode !== null}
                      onClick={() => resolveRlhf(item.id, 'validate')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium hover:bg-emerald-600/30 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {tForge('btnOkExample')}
                    </button>
                    <button
                      type="button"
                      disabled={busyMode !== null}
                      onClick={() => resolveRlhf(item.id, 'correct')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs hover:bg-zinc-700 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      {tForge('btnCorrect')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              {tForge('deepSectionTitle')}
            </h3>
            <p className="text-xs text-zinc-600 mb-2">{tForge('deepSectionHint')}</p>
            <textarea
              value={deepCorpus}
              onChange={(e) => setDeepCorpus(e.target.value)}
              className="w-full min-h-[120px] rounded-xl border border-zinc-800 bg-zinc-950 text-xs p-3 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40"
              placeholder={tForge('placeholderDeepCorpus')}
            />
            <button
              type="button"
              disabled={busyMode !== null}
              onClick={() => runAnalyze(ANALYZE_DEPTH_DEEP)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-100 text-xs font-semibold hover:bg-amber-500/15 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {tForge('deepAnalyzeBtn')}
            </button>
          </div>

          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/10 p-4">
            <h3 className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wider mb-3 flex items-center gap-1">
              {tForge('crossLearnTitle')}
              <ChevronRight className="w-3 h-3" />
            </h3>
            {data.crossLearn.length === 0 ? (
              <p className="text-xs text-zinc-600">{tForge('crossLearnEmpty')}</p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto text-xs">
                {data.crossLearn.map((c) => (
                  <li key={c.id} className="border border-zinc-800/80 rounded-lg p-2 bg-zinc-950/40">
                    <p className="text-emerald-200/95 font-medium">{c.pattern}</p>
                    <p className="text-zinc-500 mt-1">{c.notes}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            {tForge('snippetsTitle')}
          </h3>
          <div className="rounded-2xl border border-zinc-800 divide-y divide-zinc-800/80 max-h-72 overflow-y-auto">
            {data.snippets.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-zinc-600">{tForge('snippetsEmpty')}</p>
            ) : (
              data.snippets.map((s) => (
                <div key={s.id} className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-zinc-500 font-mono">
                    <span>{IA_FORGE_LABELS[s.agent_key as IaForgeAgentKey] ?? s.agent_key}</span>
                    <span className="text-zinc-700">·</span>
                    <span>{s.source}</span>
                    <span className="text-zinc-700">·</span>
                    <span>{format.dateTime(new Date(s.created_at), SNIPPET_DATETIME)}</span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{s.body}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
