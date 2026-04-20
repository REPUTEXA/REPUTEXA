'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ClipboardCopy,
  FlaskConical,
  Gavel,
  Loader2,
  ScanSearch,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { Link } from '@/i18n/navigation';
import type { CodeGuardianFinding } from '@/lib/admin/code-guardian-audit';
import type { CodeGuardianStored } from '@/lib/admin/code-guardian-state';
import type { OperationalAuditResult } from '@/lib/admin/code-guardian-operational-audit';
import { AdminModalPortal } from '@/components/admin/admin-modal-portal';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';

const LAST_SCAN_DATETIME: DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

const JOURNAL_ROW_DATETIME: DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

/** Internal filter keys (API) — labels via Admin.codeGuardian.filter* */
const FINDING_FILTER_ROWS: {
  key: 'all' | 'urgent' | 'cleanup' | 'performance' | 'structure';
  labelKey:
    | 'filterAll'
    | 'filterUrgent'
    | 'filterCleanup'
    | 'filterPerf'
    | 'filterStructure';
}[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'urgent', labelKey: 'filterUrgent' },
  { key: 'cleanup', labelKey: 'filterCleanup' },
  { key: 'performance', labelKey: 'filterPerf' },
  { key: 'structure', labelKey: 'filterStructure' },
];

function severityOrder(f: CodeGuardianFinding): number {
  return f.severity === 'urgent' ? 0 : f.severity === 'watch' ? 1 : 2;
}

export function CodeGuardianClient({ showBackLinks = true }: { showBackLinks?: boolean }) {
  const t = useTranslations('Admin.codeGuardian');
  const format = useFormatter();
  const [state, setState] = useState<CodeGuardianStored | null>(null);
  const [findings, setFindings] = useState<CodeGuardianFinding[]>([]);
  const [exportMd, setExportMd] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const [labFinding, setLabFinding] = useState<CodeGuardianFinding | null>(null);
  const [auditCode, setAuditCode] = useState('');
  const [auditContext, setAuditContext] = useState('');
  const [auditResult, setAuditResult] = useState<OperationalAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [findingFilter, setFindingFilter] = useState<'all' | CodeGuardianFinding['category'] | 'urgent'>('all');

  const categoryStyle = useCallback(
    (cat: CodeGuardianFinding['category']) => {
      switch (cat) {
        case 'cleanup':
          return {
            border: 'border-indigo-500/35',
            bg: 'bg-indigo-950/25',
            dot: 'bg-indigo-400',
            label: t('categoryCleanup'),
          };
        case 'performance':
          return {
            border: 'border-amber-500/35',
            bg: 'bg-amber-950/20',
            dot: 'bg-amber-400',
            label: t('categoryPerformance'),
          };
        case 'structure':
          return {
            border: 'border-red-500/35',
            bg: 'bg-red-950/15',
            dot: 'bg-red-400',
            label: t('categoryStructure'),
          };
        default:
          return {
            border: 'border-zinc-700',
            bg: 'bg-zinc-900/40',
            dot: 'bg-zinc-500',
            label: cat,
          };
      }
    },
    [t]
  );

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/code-guardian/state');
      const j = (await r.json()) as CodeGuardianStored & { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('toastLoadFailed'));
      setState(j);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const runScan = async () => {
    setScanning(true);
    setFindings([]);
    setExportMd('');
    try {
      const r = await fetch('/api/admin/code-guardian/scan', { method: 'POST' });
      const j = (await r.json()) as {
        audit?: { findings: CodeGuardianFinding[]; technicalDebtScore: number; scannedAt: string; summary: unknown };
        state?: CodeGuardianStored;
        exportMarkdown?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? t('toastScanFailed'));
      if (j.state) setState(j.state);
      if (j.audit) {
        setFindings(j.audit.findings);
        setExportMd(j.exportMarkdown ?? '');
        toast.success(t('toastTechnicalDebt', { score: j.audit.technicalDebtScore }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setScanning(false);
    }
  };

  const runOperationalAudit = async () => {
    setAuditing(true);
    setAuditResult(null);
    try {
      const r = await fetch('/api/admin/code-guardian/operational-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: auditCode, contextNotes: auditContext }),
      });
      const j = (await r.json()) as OperationalAuditResult & { error?: string };
      if (!r.ok) throw new Error(j.error ?? t('toastAuditFailed'));
      setAuditResult(j);
      toast.success(j.verdict === 'ok' ? t('toastVerdictOk') : t('toastVerdictReview'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setAuditing(false);
    }
  };

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error(t('toastCopyFailed'));
    }
  };

  const sortedFindings = useMemo(() => {
    return [...findings].sort((a, b) => {
      const d = severityOrder(a) - severityOrder(b);
      if (d !== 0) return d;
      return a.category.localeCompare(b.category);
    });
  }, [findings]);

  const displayFindings = useMemo(() => {
    return sortedFindings.filter((f) => {
      if (findingFilter === 'all') return true;
      if (findingFilter === 'urgent') return f.severity === 'urgent';
      return f.category === findingFilter;
    });
  }, [sortedFindings, findingFilter]);

  if (loading || !state) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const score = state.technicalDebtScore;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {showBackLinks ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('backPanelAdmin')}
          </Link>
          <Link
            href="/dashboard/admin/security-perfection"
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-rose-300/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30"
          >
            {t('backSecurity')}
          </Link>
        </div>
      ) : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">{t('pageTitle')}</h1>
            <span className="text-[10px] font-mono uppercase text-zinc-500">{t('pageBadge')}</span>
          </div>
          <p className="text-sm text-zinc-500 mt-1 leading-relaxed max-w-2xl">
            {t.rich('introRich', {
              strong: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
            })}
          </p>
        </div>
        <div
          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 px-5 py-3 min-w-[6rem] ${
            score >= 75
              ? 'border-indigo-500/45 bg-indigo-500/10'
              : score >= 45
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-red-500/40 bg-red-500/10'
          }`}
        >
          <span className="text-2xl font-black tabular-nums text-white leading-none">{score}</span>
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{t('scoreLabel')}</span>
        </div>
      </header>

      <AdminGuidePanel title={t('guideTitle')}>
        <div className="space-y-3">
          <section>
            <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideIdeaTitle')}</h3>
            <p>{t.rich('guideIdeaRich', { strong: (c) => <strong className="text-zinc-300">{c}</strong> })}</p>
          </section>
          <section>
            <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideScoreTitle')}</h3>
            <p>{t('guideScoreP')}</p>
          </section>
          <section>
            <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideAuditBtnTitle')}</h3>
            <p>{t.rich('guideAuditBtnRich', { strong: (c) => <strong className="text-zinc-300">{c}</strong> })}</p>
          </section>
          <section>
            <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideBenchTitle')}</h3>
            <p>{t.rich('guideBenchRich', { strong: (c) => <strong className="text-zinc-300">{c}</strong> })}</p>
          </section>
          <section>
            <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideHabitTitle')}</h3>
            <p>{t('guideHabitP')}</p>
          </section>
        </div>
      </AdminGuidePanel>

      <section className="rounded-2xl border border-indigo-500/25 bg-indigo-950/15 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScanSearch className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-indigo-100 uppercase tracking-widest">{t('detectorTitle')}</h2>
          </div>
          <button
            type="button"
            disabled={scanning}
            onClick={() => void runScan()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-3"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {t('btnRunAudit')}
          </button>
        </div>
        {state.lastScanAt ? (
          <p className="text-[11px] text-zinc-500 font-mono">
            {t('lastScanPrefix')} {format.dateTime(new Date(state.lastScanAt), LAST_SCAN_DATETIME)}
          </p>
        ) : (
          <p className="text-[11px] text-zinc-600">{t('noScanYet')}</p>
        )}

        {findings.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {FINDING_FILTER_ROWS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFindingFilter(key)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    findingFilter === key
                      ? 'bg-indigo-600/40 text-indigo-100 border border-indigo-400/45'
                      : 'bg-zinc-900/50 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600">
              {t('findingsShownLine', { shown: displayFindings.length, total: findings.length })}
            </p>
          </>
        )}

        {findings.length > 0 && displayFindings.length > 0 && (
          <ul className="space-y-3">
            {displayFindings.map((f) => {
              const st = categoryStyle(f.category);
              return (
                <li
                  key={f.id}
                  className={`rounded-xl border ${st.border} ${st.bg} px-4 py-3 flex gap-3 items-start`}
                >
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${st.dot}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">{st.label}</span>
                      {f.severity === 'urgent' ? (
                        <span className="text-[10px] font-mono text-red-400">{t('severityUrgent')}</span>
                      ) : f.severity === 'watch' ? (
                        <span className="text-[10px] font-mono text-amber-400">{t('severityWatch')}</span>
                      ) : (
                        <span className="text-[10px] font-mono text-indigo-300/80">{t('severityInfo')}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-zinc-100 mt-1">{f.title}</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed whitespace-pre-wrap">{f.detail}</p>
                    <button
                      type="button"
                      onClick={() => setLabFinding(f)}
                      className="mt-2 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                    >
                      {t('openLab')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {findings.length > 0 && displayFindings.length === 0 ? (
          <p className="text-xs text-amber-400/90">{t('filterNoMatch')}</p>
        ) : null}

        {exportMd ? (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-indigo-500/20">
            <button
              type="button"
              onClick={() => void copy(exportMd, t('toastReportCopied'))}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs font-semibold px-4 py-2 hover:bg-zinc-700"
            >
              <ClipboardCopy className="w-3.5 h-3.5" />
              {t('copyReportBtn')}
            </button>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-violet-400" />
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">{t('labTitle')}</h2>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('labIntro')}</p>
          <button
            type="button"
            disabled={!labFinding}
            onClick={() => labFinding && void copy(labFinding.suggestedFix, t('toastCopyOk'))}
            className="w-full rounded-lg border border-violet-500/40 bg-violet-950/20 text-violet-200 text-xs font-semibold py-2.5 disabled:opacity-40"
          >
            {t('copyLastFix')}
          </button>
          {labFinding ? (
            <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap max-h-48 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
              {labFinding.suggestedFix}
            </pre>
          ) : (
            <p className="text-xs text-zinc-600">{t('labEmpty')}</p>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">{t('supremeTitle')}</h2>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('supremeIntro')}</p>
          <textarea
            value={auditContext}
            onChange={(e) => setAuditContext(e.target.value)}
            placeholder={t('placeholderContext')}
            rows={2}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200 text-xs p-3 placeholder:text-zinc-600"
          />
          <textarea
            value={auditCode}
            onChange={(e) => setAuditCode(e.target.value)}
            placeholder={t('placeholderCode')}
            rows={8}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200 text-xs font-mono p-3 placeholder:text-zinc-600"
          />
          <button
            type="button"
            disabled={auditing || !auditCode.trim()}
            onClick={() => void runOperationalAudit()}
            className="w-full rounded-lg bg-emerald-700/90 hover:bg-emerald-600 text-white text-xs font-bold py-2.5 disabled:opacity-40"
          >
            {auditing ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : (
              t('btnOperationalAudit')
            )}
          </button>
          {auditResult ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
              <p className="text-xs text-emerald-200/90 font-medium">{auditResult.summary}</p>
              <ul className="space-y-1.5">
                {auditResult.checks.map((c) => (
                  <li key={c.id} className="flex gap-2 text-[11px] text-zinc-400">
                    {c.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{c.label}</span>
                    {c.detail ? <span className="text-red-300/90"> — {c.detail}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-indigo-500/20 bg-zinc-900/20 p-5">
        <h2 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-3">{t('indigoTrackTitle')}</h2>
        <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800/80 max-h-56 overflow-y-auto">
          {state.indigoJournal.length === 0 ? (
            <p className="text-center text-xs text-zinc-600 py-8">{t('journalEmpty')}</p>
          ) : (
            [...state.indigoJournal].reverse().map((e, i) => (
              <div key={`${e.at}-${i}`} className="px-3 py-2 text-[11px]">
                <span className="text-zinc-600 font-mono mr-2">
                  {format.dateTime(new Date(e.at), JOURNAL_ROW_DATETIME)}
                </span>
                <span className="text-indigo-400 font-semibold uppercase text-[10px] mr-2">{e.kind}</span>
                <span className="text-zinc-400">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {labFinding ? (
        <AdminModalPortal>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-[9600] bg-black/65 backdrop-blur-sm"
            onClick={() => setLabFinding(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[9601] w-[min(100vw-1.5rem,640px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-indigo-500/35 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white truncate pr-2">{labFinding.title}</h3>
              <button
                type="button"
                onClick={() => setLabFinding(null)}
                className="text-zinc-500 hover:text-white text-xs font-mono px-2 py-1"
              >
                {t('modalClose')}
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 min-h-0">
              <p className="text-xs text-zinc-500 whitespace-pre-wrap">{labFinding.detail}</p>
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                  {t('suggestedFixHeading')}
                </p>
                <pre className="text-[11px] font-mono text-indigo-100/90 whitespace-pre-wrap bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 max-h-64 overflow-y-auto">
                  {labFinding.suggestedFix}
                </pre>
              </div>
              <button
                type="button"
                onClick={() => void copy(labFinding.suggestedFix, t('toastCopiedShort'))}
                className="w-full rounded-lg bg-indigo-600 text-white text-xs font-semibold py-2.5"
              >
                {t('copyForCursor')}
              </button>
            </div>
          </div>
        </AdminModalPortal>
      ) : null}
    </div>
  );
}
