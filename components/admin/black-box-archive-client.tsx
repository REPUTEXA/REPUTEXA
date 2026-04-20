'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Database,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { AdminToolbarButton } from '@/components/admin/admin-toolbar-button';

type IndexRow = {
  id: string;
  source_kind: string;
  source_table: string;
  occurred_at_min: string;
  occurred_at_max: string;
  row_count: number;
  user_ids: string[];
  search_text: string;
  gzip_bytes: number;
  approx_plain_bytes: number;
  hot_deleted: boolean;
  ai_summary: string | null;
  created_at: string;
};

type RunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  batches_written: number;
  rows_archived: number;
  bytes_out: number;
  error_message: string | null;
  detail?: { skippedReason?: string | null; skippedDetail?: string | null } | null;
};

type BlackBoxMeta = {
  archiveEnabled: boolean;
  s3Configured: boolean;
  hotRetentionDays: number;
};

type BlackBoxStats = {
  indexCount: number;
  lastRun: RunRow | null;
};

const BLACK_BOX_TABLE_FILTERS = [
  ['reviews', 'tableOptionReviews'],
  ['support_audit_log', 'tableOptionSupportAudit'],
  ['review_queue', 'tableOptionReviewQueue'],
  ['contact_messages', 'tableOptionContactMessages'],
] as const;

export function BlackBoxArchiveClient() {
  const t = useTranslations('Dashboard.adminBlackBoxArchive');
  const tRich = t.rich;
  const format = useFormatter();
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [table, setTable] = useState('');
  const [limit, setLimit] = useState(50);
  const [items, setItems] = useState<IndexRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPayload, setLoadingPayload] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [meta, setMeta] = useState<BlackBoxMeta | null>(null);
  const [stats, setStats] = useState<BlackBoxStats | null>(null);

  const translateSkippedReason = useCallback(
    (code: string | undefined, detailJ?: string | null): string => {
      if (!code) return '';
      if (code === 'no_eligible_rows') {
        return t('skippedNoEligible', { days: detailJ ?? '?' });
      }
      if (code === 'pas de BACKUP_S3_*') return t('skippedNoBackupS3');
      if (code === 'BLACK_BOX_ARCHIVE_ENABLED=0') return t('skippedArchiveDisabled');
      return code;
    },
    [t],
  );

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim().length >= 2) p.set('q', q.trim());
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (table) p.set('table', table);
      p.set('limit', String(Math.min(80, Math.max(10, limit))));
      const res = await fetch(`/api/admin/black-box-archive?${p}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : t('errGeneric'));
      setItems(j.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastSearchFailed'));
    } finally {
      setLoading(false);
    }
  }, [q, from, to, table, limit, t]);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/black-box-archive?runs=1', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setRuns(j.runs ?? []);
    } catch {
      /* silencieux */
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/black-box-archive?meta=1', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && typeof j.hotRetentionDays === 'number') {
        setMeta({
          archiveEnabled: j.archiveEnabled !== false,
          s3Configured: !!j.s3Configured,
          hotRetentionDays: j.hotRetentionDays,
        });
      }
    } catch {
      /* silencieux */
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/black-box-archive?stats=1', { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (res.ok && typeof j.indexCount === 'number') {
        setStats({ indexCount: j.indexCount, lastRun: j.lastRun ?? null });
      }
    } catch {
      /* silencieux */
    }
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void search();
    void loadRuns();
    void loadMeta();
    void loadStats();
  }, [search, loadRuns, loadMeta, loadStats]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebouncePrimed = useRef(false);
  useEffect(() => {
    if (!booted.current) return;
    if (!filterDebouncePrimed.current) {
      filterDebouncePrimed.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void search();
    }, 320);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, from, to, table, limit, search]);

  const runManual = async () => {
    setRunBusy(true);
    try {
      const res = await fetch('/api/admin/black-box-archive', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : t('errGeneric'));
      const batches = j.batches ?? 0;
      const rows = j.rows ?? 0;
      const skipped = typeof j.skippedReason === 'string' ? j.skippedReason : '';
      if (batches === 0 && rows === 0 && skipped) {
        toast.message(translateSkippedReason(skipped, j.skippedDetail ?? null), {
          duration: 9000,
        });
      } else {
        const kb = ((j.bytes ?? 0) / 1024).toFixed(1);
        toast.success(t('toastArchiveSuccess', { batches, rows, kb }));
      }
      await search();
      await loadRuns();
      await loadStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastRunFailed'));
    } finally {
      setRunBusy(false);
    }
  };

  const fetchPayload = async (id: string) => {
    setLoadingPayload(id);
    setPreview(null);
    try {
      const res = await fetch(`/api/admin/black-box-archive/${id}/payload`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : t('errGeneric'));
      setPreview(JSON.stringify(j.payload ?? j, null, 2));
      toast.success(t('toastPayloadOk'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toastReadFailed'));
    } finally {
      setLoadingPayload(null);
    }
  };

  const fmtDateTime = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'short', timeStyle: 'medium' });
  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'short' });

  return (
    <div className="min-h-full pb-16">
      <div className="border-b border-zinc-800/40 bg-zinc-950/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <AdminToolbarButton
            variant="secondary"
            onClick={() => {
              void search();
              void loadRuns();
              void loadMeta();
              void loadStats();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('syncButton')}
          </AdminToolbarButton>
          <AdminToolbarButton variant="primary" disabled={runBusy} onClick={() => void runManual()}>
            {runBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {t('archiveNowButton')}
          </AdminToolbarButton>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <AdminGuidePanel title={t('guidePanelTitle')}>
          <div className="space-y-3">
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideWhatForTitle')}
              </h3>
              <p>
                {tRich('guideWhatForBody', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideBeforeTitle')}
              </h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>{t('guideBeforeLi1')}</li>
                <li>
                  {tRich('guideBeforeLi2', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideBeforeLi3', {
                    mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                  })}
                </li>
              </ul>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideWhyNothingTitle')}
              </h3>
              <p>
                {tRich('guideWhyNothingBody', {
                  hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                })}
              </p>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideTablesTitle')}
              </h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>{t('guideTablesLi1')}</li>
                <li>
                  {tRich('guideTablesLi2', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
              </ul>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideButtonsTitle')}
              </h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  {tRich('guideButtonsLi1', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideButtonsLi2', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideButtonsLi3', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
                <li>
                  {tRich('guideButtonsLi4', {
                    hl: (chunks) => <strong className="text-zinc-300">{chunks}</strong>,
                  })}
                </li>
              </ul>
            </section>
            <section>
              <h3 className="text-zinc-200 font-semibold text-[11px] uppercase tracking-wide mb-1">
                {t('guideAutomationTitle')}
              </h3>
              <p>
                {tRich('guideAutomationBody', {
                  mono: (chunks) => <span className="font-mono text-zinc-500">{chunks}</span>,
                })}
              </p>
            </section>
          </div>
        </AdminGuidePanel>

        {stats ? (
          <div className="rounded-xl border border-sky-500/20 bg-sky-950/15 px-4 py-3 text-xs text-sky-100/90 space-y-1">
            <p className="font-semibold text-sky-200/95">{t('statsOverviewTitle')}</p>
            <p className="text-zinc-400">
              {t('statsIndexedLabel')}{' '}
              <span className="font-mono text-sky-300 tabular-nums">
                {format.number(stats.indexCount)}
              </span>
            </p>
            {stats.lastRun ? (
              <p className="text-zinc-500 text-[11px] font-mono">
                {t('statsLastRunLine', {
                  status: stats.lastRun.status,
                  date: fmtDateTime(stats.lastRun.started_at),
                  rows: stats.lastRun.rows_archived ?? 0,
                })}
              </p>
            ) : (
              <p className="text-zinc-500 text-[11px]">{t('statsNoRun')}</p>
            )}
          </div>
        ) : null}

        {meta ? (
          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400 space-y-1">
            <p>
              {tRich('metaHotIntro', {
                hl: (chunks) => <strong className="text-zinc-200">{chunks}</strong>,
                days: () => <span className="font-mono text-sky-300/90">{String(meta.hotRetentionDays)}</span>,
              })}
            </p>
            <p className="font-mono text-[10px] text-zinc-500">
              {t('metaS3ConfiguredLabel')}{' '}
              {meta.s3Configured ? t('metaYes') : t('metaNo')} · {t('metaArchiveActiveLabel')}{' '}
              {meta.archiveEnabled ? t('metaYes') : t('metaArchiveDisabledValue')}
            </p>
            {!meta.s3Configured ? (
              <p className="text-[10px] text-zinc-500 leading-relaxed border-t border-zinc-800/60 pt-2 mt-2">
                {tRich('metaS3Help', {
                  hl: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
                  mono: (chunks) => <span className="font-mono text-zinc-400">{chunks}</span>,
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <Search className="w-3.5 h-3.5" />
            {t('searchIndexHeading')}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            />
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            >
              <option value="">{t('tableOptionAll')}</option>
              {BLACK_BOX_TABLE_FILTERS.map(([value, labelKey]) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              title={t('limitSelectTitle')}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
            >
              <option value={25}>{t('limitOption25')}</option>
              <option value={50}>{t('limitOption50')}</option>
              <option value={80}>{t('limitOption80')}</option>
            </select>
          </div>
          <p className="text-[10px] text-zinc-600">{t('filtersHint')}</p>
          <button
            type="button"
            onClick={() => search()}
            className="text-xs px-3 py-1.5 rounded-lg bg-sky-600/80 text-white hover:bg-sky-600"
          >
            {t('searchNowButton')}
          </button>
        </div>

        {runs.length > 0 ? (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              {t('runsSectionTitle')}
            </h2>
            <div className="rounded-xl border border-zinc-800 divide-y divide-zinc-800/80 text-xs font-mono">
              {runs.slice(0, 8).map((r) => (
                <div key={r.id} className="px-4 py-2 flex flex-wrap gap-4 text-zinc-400">
                  <span className={r.status === 'ok' ? 'text-emerald-400' : r.status === 'failed' ? 'text-red-400' : 'text-amber-300'}>
                    {r.status}
                  </span>
                  <span>{fmtDateTime(r.started_at)}</span>
                  <span>
                    {t('runStatsLine', {
                      batches: r.batches_written,
                      rows: r.rows_archived,
                      kb: (r.bytes_out / 1024).toFixed(1),
                    })}
                  </span>
                  {r.error_message ? <span className="text-red-400">{r.error_message}</span> : null}
                  {!r.error_message &&
                  r.detail &&
                  typeof r.detail.skippedReason === 'string' &&
                  r.batches_written === 0 ? (
                    <span className="text-amber-400/95 max-w-full">
                      {translateSkippedReason(r.detail.skippedReason, r.detail.skippedDetail ?? null)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">{t('archivedLotsTitle')}</h2>
          {loading ? (
            <p className="text-zinc-600 text-sm">{t('loading')}</p>
          ) : items.length === 0 ? (
            <p className="text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl p-8 text-center space-y-2">
              <span className="block">
                {tRich('emptyHotExplanation', {
                  strong: (chunks) => <strong className="text-zinc-400">{chunks}</strong>,
                  retention: () =>
                    meta ? (
                      <span className="font-mono text-sky-400/90">
                        {meta.hotRetentionDays} {t('daysWord')}
                      </span>
                    ) : (
                      <span className="font-mono text-zinc-500">{t('emptyWindowRetentionEnv')}</span>
                    ),
                })}
              </span>
              <span className="block text-zinc-500 text-xs">
                {tRich('emptyHintSecondary', {
                  mono: (chunks) => <span className="font-mono">{chunks}</span>,
                })}
              </span>
              {meta && !meta.s3Configured ? (
                <span className="block text-amber-400/90 text-xs">
                  {tRich('emptyS3Warning', {
                    mono: (chunks) => <span className="font-mono">{chunks}</span>,
                  })}
                </span>
              ) : null}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-100">
                      <span className="text-sky-400/90">{row.source_table}</span>
                      <span className="text-zinc-600 mx-2">·</span>
                      <span className="text-zinc-400 font-normal">
                        {t('rowCountLine', {
                          count: row.row_count,
                          from: fmtDate(row.occurred_at_min),
                          to: fmtDate(row.occurred_at_max),
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={loadingPayload === row.id}
                      onClick={() => fetchPayload(row.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 text-emerald-200 text-xs hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {loadingPayload === row.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {t('decompressPreviewButton')}
                    </button>
                  </div>
                  {row.ai_summary ? (
                    <p className="text-xs text-violet-200/90 border-l-2 border-violet-500/40 pl-2">{row.ai_summary}</p>
                  ) : null}
                  <p className="text-xs text-zinc-500 line-clamp-2">{row.search_text.slice(0, 380)}…</p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    {t('gzipLine', {
                      gzipKb: (row.gzip_bytes / 1024).toFixed(1),
                      plainKb: (row.approx_plain_bytes / 1024).toFixed(1),
                      hotDelete: row.hot_deleted ? t('metaYes') : t('metaNo'),
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {preview ? (
          <section>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{t('jsonPreviewTitle')}</h2>
            <pre className="max-h-[420px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-[11px] text-zinc-300 font-mono whitespace-pre-wrap">
              {preview}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}
