'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { SupportVerdictModal } from '@/components/support/support-verdict-modal';
import { AdminHelpPastille, AdminStatusDot } from '@/components/admin/admin-help-pastille';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { AdminModalPortal } from '@/components/admin/admin-modal-portal';

type NexusTicketRow = {
  id: string;
  user_id: string;
  gravity_score: number | null;
  /** Dernier score confiance bootstrap (&lt; 80 = ligne « à relire » violet). */
  diagnostic_confidence: number | null;
  title: string | null;
  updated_at: string;
  client_label: string;
};

type ChatMsg = { id?: string; sender: string; content: string; created_at?: string };

type NexusFactRow = { claim: string; source: string; observed_at?: string };
type NexusDoubtRow = { topic: string; reason: string };

const NEXUS_SCANNED_AT_FORMAT: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'medium',
};

type NexusDiagnosticPayload = {
  FACTS: NexusFactRow[];
  DOUBTS: NexusDoubtRow[];
  SUGGESTED_ACTION: unknown;
  confidence_score: number | null;
  scanned_at: string;
};

function gravityStyle(score: number | null) {
  const s = score ?? 0;
  if (s >= 70) {
    return {
      bar: 'bg-red-500',
      badge: 'bg-red-500/20 text-red-300 border-red-500/35',
      row: 'border-red-500/50',
      panelBg: 'bg-red-500/5',
      dot: 'critical' as const,
    };
  }
  if (s >= 40) {
    return {
      bar: 'bg-amber-400',
      badge: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
      row: 'border-amber-500/45',
      panelBg: 'bg-amber-500/5',
      dot: 'warn' as const,
    };
  }
  return {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    row: 'border-emerald-500/40',
    panelBg: 'bg-emerald-500/5',
    dot: 'ok' as const,
  };
}

export function NexusSupportClient() {
  const router = useRouter();
  const format = useFormatter();
  const t = useTranslations('Dashboard.adminNexusSupport');
  const tVerdict = useTranslations('Dashboard.supportVerdict');
  const closePanel = useCallback(() => {
    router.push('/dashboard/admin');
  }, [router]);

  const pendingLabel = useCallback(
    (tool: string) => {
      const map: Record<string, string> = {
        restart_webhook: t('pending_restart_webhook'),
        regenerate_api_key: t('pending_regenerate_api_key'),
        validate_phone_format: t('pending_validate_phone_format'),
        create_github_pr: t('pending_create_github_pr'),
        submit_dev_backlog: t('pending_submit_dev_backlog'),
      };
      return map[tool] ?? tool;
    },
    [t],
  );

  const filterOptions = useMemo(
    () =>
      [
        ['all', t('filterAll')],
        ['critical', t('filterCritical')],
        ['uncertain', t('filterUncertain')],
      ] as const,
    [t],
  );

  const [tickets, setTickets] = useState<NexusTicketRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [clientLabel, setClientLabel] = useState('');
  const [gravityScore, setGravityScore] = useState<number | null>(null);
  const [pendingKeys, setPendingKeys] = useState<{ idempotency_key: string; tool: string }[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [verdictOpen, setVerdictOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [nexusDiagnostic, setNexusDiagnostic] = useState<NexusDiagnosticPayload | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'critical' | 'uncertain'>('all');
  const [listSearch, setListSearch] = useState('');

  const refreshList = useCallback(async () => {
    setListError(null);
    try {
      const res = await fetch('/api/admin/nexus/tickets');
      const data = (await res.json()) as { tickets?: NexusTicketRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errList'));
      setTickets(data.tickets ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setLoadingList(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshList();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [refreshList]);

  const filteredTickets = useMemo(() => {
    const needle = listSearch.trim().toLowerCase();
    return tickets.filter((t) => {
      if (listFilter === 'critical' && (t.gravity_score ?? 0) < 70) return false;
      if (listFilter === 'uncertain') {
        const c = t.diagnostic_confidence;
        if (c == null || c >= 80) return false;
      }
      if (needle) {
        const hay = `${t.client_label} ${t.title ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [tickets, listFilter, listSearch]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closePanel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closePanel]);

  const fetchTicketDetail = useCallback(async (id: string) => {
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/admin/nexus/tickets/${id}`);
      const data = (await res.json()) as {
        ticket?: NexusTicketRow & { client_label?: string };
        messages?: ChatMsg[];
        pending_approvals?: { idempotency_key: string; tool: string }[];
        nexus_diagnostic?: NexusDiagnosticPayload | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errTicket'));
      setMessages(data.messages ?? []);
      setClientLabel(String(data.ticket?.client_label ?? ''));
      setGravityScore((data.ticket?.gravity_score as number | null) ?? null);
      setPendingKeys(data.pending_approvals ?? []);
      setNexusDiagnostic(data.nexus_diagnostic ?? null);
    } catch {
      setMessages([]);
      setPendingKeys([]);
      setNexusDiagnostic(null);
    } finally {
      setLoadingChat(false);
    }
  }, [t]);

  useEffect(() => {
    if (!selectedId) return;
    void fetchTicketDetail(selectedId);
  }, [selectedId, fetchTicketDetail]);

  async function approveKey(key: string) {
    setActionBusy(key);
    try {
      const res = await fetch(`/api/admin/support/pending-actions/${encodeURIComponent(key)}/approve`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errApprove'));
      toast.success(t('toastApproveOk'));
      if (selectedId) void fetchTicketDetail(selectedId);
      void refreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setActionBusy(null);
    }
  }

  async function rejectKey(key: string) {
    setActionBusy(key);
    try {
      const res = await fetch(`/api/admin/support/pending-actions/${encodeURIComponent(key)}/reject`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errReject'));
      toast.success(t('toastRejectOk'));
      if (selectedId) void fetchTicketDetail(selectedId);
      void refreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setActionBusy(null);
    }
  }

  async function submitArchive(problem: string, solution: string) {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/nexus/tickets/${selectedId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict_problem: problem, verdict_solution: solution }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errArchive'));
      toast.success(t('toastArchiveOk'));
      setSelectedId(null);
      setMessages([]);
      setPendingKeys([]);
      await refreshList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
      throw e;
    }
  }

  const gs = gravityStyle(gravityScore);
  const conf = nexusDiagnostic?.confidence_score;
  const confBoxClass =
    conf == null
      ? 'border-zinc-600/50 bg-zinc-800/30'
      : conf >= 80
        ? 'border-emerald-500/50 bg-emerald-500/10'
        : conf >= 50
          ? 'border-amber-500/50 bg-amber-500/10'
          : 'border-violet-500/55 bg-violet-500/10';

  return (
    <AdminModalPortal>
      <>
        <div
          className="fixed inset-0 z-[9600] flex items-center justify-center p-3 sm:p-6 text-zinc-100"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/75 backdrop-blur-[10px] sm:backdrop-blur-xl"
            aria-label={t('overlayCloseAria')}
            onClick={closePanel}
          />
          <div
            className="relative z-10 flex h-[min(92dvh,calc(100dvh-1.5rem))] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950 shadow-2xl shadow-black/50 ring-1 ring-white/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nexus-live-overlay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
              <div className="absolute -left-1/4 -top-1/2 h-[70%] w-[70%] bg-[radial-gradient(circle,rgba(139,92,246,0.12),transparent_65%)]" />
            </div>

            <div className="relative flex shrink-0 items-start gap-3 border-b border-zinc-800 bg-zinc-900/85 px-4 py-3 sm:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/40 bg-violet-600/20">
                <Crosshair className="h-5 w-5 text-violet-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h2 id="nexus-live-overlay-title" className="text-sm font-bold tracking-tight text-white">
                    {t('title')}
                  </h2>
                  <AdminHelpPastille text={t('helpPastille')} />
                </div>
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  {t.rich('subtitleRich', {
                    blur: (chunks) => <span className="text-zinc-400">{chunks}</span>,
                  })}
                </p>
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <AdminGuidePanel title={t('guideTitle')} variant="compact">
                    <div className="space-y-3">
                      <section>
                        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideTwoTitle')}</h3>
                        <p>
                          {t.rich('guideTwoRich', {
                            strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                          })}
                        </p>
                      </section>
                      <section>
                        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideColorsTitle')}</h3>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            {t.rich('guideColorCritical', {
                              strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                            })}
                          </li>
                          <li>
                            {t.rich('guideColorOrange', {
                              strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                            })}
                          </li>
                          <li>
                            {t.rich('guideColorGreen', {
                              strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                            })}
                          </li>
                          <li>
                            {t.rich('guideColorViolet', {
                              strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                            })}
                          </li>
                        </ul>
                      </section>
                      <section>
                        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideOpenTitle')}</h3>
                        <p>{t('guideOpen')}</p>
                      </section>
                      <section>
                        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideApproveTitle')}</h3>
                        <p>
                          {t.rich('guideApproveRich', {
                            strong: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                          })}
                        </p>
                      </section>
                      <section>
                        <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">{t('guideAfterTitle')}</h3>
                        <p>{t('guideAfter')}</p>
                      </section>
                    </div>
                  </AdminGuidePanel>
                </div>
                <Link
                  href="/dashboard/admin"
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t('backAdmin')}
                </Link>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors shrink-0"
                aria-label={t('closeAria')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
              <aside className="flex w-full max-h-[38vh] flex-col border-b border-zinc-800/90 bg-zinc-900/35 lg:max-h-none lg:min-h-0 lg:w-[320px] lg:shrink-0 lg:border-b-0 lg:border-r">
                <div className="border-b border-zinc-800/80 px-4 py-3 sm:px-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void refreshList()}
                      className="rounded-lg border border-zinc-700/90 bg-zinc-900/80 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800"
                    >
                      {t('refreshQueue')}
                    </button>
                    <span className="text-[10px] text-zinc-600">{t('autoPoll', { count: tickets.length })}</span>
                  </div>
                  <input
                    type="search"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {filterOptions.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setListFilter(key)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                          listFilter === key
                            ? 'bg-violet-600/35 text-violet-100 border border-violet-500/40'
                            : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.55)]" />
                  {t('legendUrgent')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {t('legendMid')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {t('legendLow')}
                </span>
                    <span className="inline-flex items-center gap-1 text-violet-400/90">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.7)]" />
                      {t('legendConf')}
                    </span>
                  </div>
                </div>
                <div className="custom-scrollbar flex-1 overflow-y-auto p-2 sm:p-3">
                  {loadingList ? (
                    <div className="flex justify-center py-14">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                    </div>
                  ) : listError ? (
                    <p className="px-2 py-4 text-xs text-red-400">{listError}</p>
                  ) : tickets.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-zinc-500">{t('emptyList')}</p>
                  ) : filteredTickets.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-amber-400/90">{t('emptyFilter')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {filteredTickets.map((row) => {
                    const st = gravityStyle(row.gravity_score);
                    const active = selectedId === row.id;
                    const lowConf =
                      row.diagnostic_confidence != null && row.diagnostic_confidence < 80;
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(row.id)}
                              className={[
                                'w-full rounded-2xl border-2 px-3 py-2.5 text-left transition-all',
                                st.row,
                                st.panelBg,
                                active
                                  ? 'bg-zinc-900/80 ring-2 ring-violet-500/50 shadow-lg shadow-violet-500/10'
                                  : 'hover:bg-zinc-900/60',
                                lowConf
                                  ? 'ring-2 ring-violet-400/50 ring-offset-2 ring-offset-zinc-950 animate-[pulse_2.5s_ease-in-out_infinite]'
                                  : '',
                              ].join(' ')}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <AdminStatusDot
                                    tone={st.dot}
                                    title={
                                      (row.gravity_score ?? 0) >= 70
                                        ? t('dotCritical')
                                        : (row.gravity_score ?? 0) >= 40
                                          ? t('dotModerate')
                                          : t('dotLow')
                                    }
                                  />
                                  <span
                                    className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${st.badge}`}
                                  >
                                    G {row.gravity_score ?? '—'}
                                  </span>
                                  {row.diagnostic_confidence != null ? (
                                    <span className="font-mono text-[9px] text-zinc-500">
                                      {t('diagConfPrefix')}
                                      {row.diagnostic_confidence}
                                    </span>
                                  ) : null}
                                </span>
                                <ChevronRight
                                  className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-violet-400' : 'text-zinc-600'}`}
                                />
                              </div>
                              <p className="mt-1.5 truncate text-xs font-medium text-zinc-100">
                                {row.client_label}
                              </p>
                              <p className="truncate text-[10px] text-zinc-500">{row.title ?? t('noTitle')}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </aside>

              <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950/25">
                {!selectedId ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700/80 bg-zinc-900/50">
                      <ShieldAlert className="h-7 w-7 text-zinc-500" />
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                      {t.rich('selectPromptRich', {
                        red: (chunks) => <span className="text-red-300">{chunks}</span>,
                        violet: (chunks) => <span className="text-violet-300">{chunks}</span>,
                      })}
                    </p>
                  </div>
                ) : (
                  <>
                    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-zinc-800/90 bg-zinc-900/40 px-4 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{t('headerClient')}</p>
                    <p className="truncate text-sm font-semibold text-white">{clientLabel}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] ${gs.badge}`}>
                        {t('gravityLabel', { score: gravityScore ?? '—' })}
                      </span>
                      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-800">
                        <span
                          className={`block h-full rounded-full ${gs.bar}`}
                          style={{ width: `${Math.min(100, gravityScore ?? 0)}%` }}
                        />
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {nexusDiagnostic?.confidence_score != null ? (
                      <div
                        className={`flex min-w-[5.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-3 py-2 ${confBoxClass}`}
                      >
                        <span className="text-xl font-black tabular-nums leading-none text-white">
                          {nexusDiagnostic.confidence_score}
                        </span>
                        <span className="text-[9px] font-semibold tabular-nums text-zinc-400">{t('scoreOutOf100')}</span>
                        <span className="text-[8px] leading-none text-zinc-600">{t('confidenceShort')}</span>
                      </div>
                    ) : null}
                    <Link
                      href="/dashboard/support"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-[11px] font-semibold text-violet-200 hover:bg-zinc-800"
                    >
                      {t('vueClient')} <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setVerdictOpen(true)}
                      title={t('closeVerdictTitle')}
                      className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                    >
                      {t('closeVerdictCta')}
                    </button>
                  </div>
                </header>

                {pendingKeys.length > 0 ? (
                  <div className="mx-4 mt-3 space-y-2 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 sm:mx-6">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-200">
                      <span aria-hidden>🤖</span>
                      {t('aiSuggestTitle')}
                      <AdminHelpPastille text={t('aiSuggestHelp')} />
                    </p>
                    <ul className="space-y-2">
                      {pendingKeys.map((p) => (
                        <li
                          key={p.idempotency_key}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/90 bg-zinc-950/55 px-3 py-2.5"
                        >
                          <span className="text-xs text-zinc-200">
                            <span className="font-semibold text-amber-100/95">
                              {pendingLabel(p.tool)}
                            </span>
                            <span className="ml-2 font-mono text-[10px] text-zinc-600">
                              {p.idempotency_key.slice(0, 8)}…
                            </span>
                          </span>
                          <span className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={actionBusy === p.idempotency_key}
                              onClick={() => void approveKey(p.idempotency_key)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t('approve')}
                            </button>
                            <button
                              type="button"
                              disabled={actionBusy === p.idempotency_key}
                              onClick={() => void rejectKey(p.idempotency_key)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-bold text-zinc-300 hover:border-red-500/40 hover:bg-red-950/30 disabled:opacity-40"
                            >
                              <XCircle className="h-3 w-3" />
                              {t('refuse')}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                  <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                    {loadingChat ? (
                      <div className="flex justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((m, i) => (
                          <div
                            key={m.id ?? `${m.sender}-${i}`}
                            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-lg ${
                                m.sender === 'user'
                                  ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white'
                                  : 'rounded-bl-md border border-zinc-700/80 bg-zinc-900/70 text-zinc-100 backdrop-blur-sm'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{m.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {nexusDiagnostic ? (
                    <aside
                      className={[
                        'custom-scrollbar max-h-[min(40vh,320px)] shrink-0 overflow-y-auto border-t border-zinc-800/90 bg-emerald-950/10 px-4 py-4 lg:max-h-none lg:w-[min(100%,360px)] lg:border-l lg:border-t-0',
                        conf != null && conf < 80
                          ? 'ring-2 ring-inset ring-violet-500/40'
                          : '',
                      ].join(' ')}
                    >
                      <div className="mb-3 flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                        <Sparkles className="h-4 w-4 shrink-0 text-emerald-400" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/95">
                          {t('diagnosticTitle')}
                        </p>
                        <AdminHelpPastille text={t('diagnosticHelp')} />
                      </div>
                      {nexusDiagnostic.scanned_at ? (
                        <p className="mb-3 font-mono text-[10px] text-zinc-600">
                          {format.dateTime(new Date(nexusDiagnostic.scanned_at), NEXUS_SCANNED_AT_FORMAT)}
                        </p>
                      ) : null}
                      <div className="mb-4 rounded-xl border border-zinc-700/80 bg-zinc-950/50 px-3 py-2">
                        <p className="mb-0.5 text-[10px] font-semibold uppercase text-zinc-500">
                          {t('confidenceBlock')}
                        </p>
                        <p className="text-lg font-black tabular-nums text-white">
                          {nexusDiagnostic.confidence_score ?? t('dashEmpty')}
                          <span className="text-sm font-normal text-zinc-500">{t('scoreDenomTight')}</span>
                        </p>
                      </div>
                      <div className="mb-4">
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
                          {t('factsTitle')}
                        </p>
                        <ul className="space-y-2 text-[11px] leading-snug text-zinc-300">
                          {(nexusDiagnostic.FACTS ?? []).slice(0, 14).map((f, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="shrink-0 text-emerald-500">{t('factBullet')}</span>
                              <span>
                                {f.claim}
                                <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
                                  {f.source}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
                          {t('doubtsTitle')}
                        </p>
                        <ul className="space-y-2 text-[11px] text-zinc-400">
                          {(nexusDiagnostic.DOUBTS ?? []).map((d, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="shrink-0 text-amber-500">?</span>
                              <span>
                                <span className="font-medium text-zinc-300">{d.topic}</span> — {d.reason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </aside>
                  ) : null}
                </div>
                  </>
                )}
              </main>
            </div>
          </div>
        </div>

        <SupportVerdictModal
          open={verdictOpen}
          onOpenChange={setVerdictOpen}
          onConfirm={submitArchive}
          title={tVerdict('nexusAdminTitle')}
          confirmLabel={tVerdict('nexusAdminConfirm')}
        />
      </>
    </AdminModalPortal>
  );
}
