'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { FileText, ArrowRight, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { PlanSlug } from '@/lib/feature-gate';
import type { SummaryStats } from '@/lib/monthly-reports/types';

type Report = {
  id: string;
  month: number;
  year: number;
  report_type: string;
  pdf_ready: boolean;
  summary_stats: SummaryStats | null;
  created_at: string;
};

type ArchivesInsightsSectionProps = {
  planSlug: PlanSlug;
  locale: string;
};

const cardClass =
  'rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)]';

export function ArchivesInsightsSection({ planSlug, locale }: ArchivesInsightsSectionProps) {
  const t = useTranslations('Dashboard.monthlyArchive');
  const format = useFormatter();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const h = setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 380);
    return () => clearTimeout(h);
  }, [qInput]);

  useEffect(() => {
    let cancelled = false;
    async function fetchReports() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/monthly-reports/list?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data.reports)) return;
        setReports(data.reports);
        setTotal(typeof data.total === 'number' ? data.total : data.reports.length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReports();
    return () => {
      cancelled = true;
    };
  }, [page, q, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = Math.min(page * pageSize, total);

  if (loading && reports.length === 0 && !qInput) {
    return (
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span>📁</span>
          {t('title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('intro')}
        </p>
      </div>

      {(planSlug === 'vision' || planSlug === 'free') && (
        <div className={`${cardClass} px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {t('upgradeTeaser')}
          </p>
          <a
            href={`/${locale}/pricing`}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400 hover:underline"
          >
            <ArrowRight className="w-4 h-4" />
            {t('comparePlans')}
          </a>
        </div>
      )}

      <div className={`${cardClass} p-4 space-y-4`}>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 max-w-xl">
          {t('searchLabel')}
          <span className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </span>
        </label>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            {t('loading')}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('empty')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('colDate')}
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('colDocument')}
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t('colAction')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const monthStart = new Date(r.year, r.month - 1, 1);
                    const dateLabel = format.dateTime(monthStart, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    });
                    const period = format.dateTime(monthStart, {
                      month: 'long',
                      year: 'numeric',
                    });
                    const docName = t('reportPdfName', { period });
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {dateLabel}
                        </td>
                        <td className="px-5 py-3 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {docName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {r.pdf_ready ? (
                            <a
                              href={`/api/monthly-reports/download?year=${r.year}&month=${r.month}`}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              {t('download')}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">{t('pending')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {total > pageSize && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('paginationRange', { from: fromIdx, to: toIdx, total })}
                  {t('paginationDot')}
                  {t('paginationPage', { page, totalPages })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('prev')}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    {t('next')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
