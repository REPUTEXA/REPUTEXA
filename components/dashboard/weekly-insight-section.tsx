'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CalendarRange,
} from 'lucide-react';
import type { PlanSlug } from '@/lib/feature-gate';
import { hasFeature, FEATURES } from '@/lib/feature-gate';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { format, setISOWeek, startOfISOWeek } from 'date-fns';
import { useTranslations } from 'next-intl';

type WeeklyReport = {
  id: string;
  week_start: string;
  establishment_name: string;
  avg_rating: number;
  total_reviews: number;
  top_section: string | null;
  watch_section: string | null;
  advice_section: string | null;
  full_report_json: { fullReport?: string; weekLabel?: string } | null;
  trend_severity: number | null;
  created_at: string;
};

type Props = { planSlug: PlanSlug; locale: string };

function formatWeekLabel(weekStart: string, intlDateTag: string): string {
  if (!weekStart) return '';
  const d = new Date(weekStart + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return weekStart;
  return d.toLocaleDateString(intlDateTag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Valeur `input type="week"` (ex. 2026-W13) → lundi ISO, aligné avec les `week_start` stockés. */
function isoWeekPickerToMonday(weekVal: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekVal.trim());
  if (!m) return null;
  const isoWeekYear = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(isoWeekYear, 0, 4);
  const monday = startOfISOWeek(setISOWeek(jan4, week));
  if (Number.isNaN(monday.getTime())) return null;
  return format(monday, 'yyyy-MM-dd');
}

export function WeeklyInsightSection({ planSlug, locale: _locale }: Props) {
  const t = useTranslations('Dashboard.weeklyInsight');
  const searchParams = useSearchParams();
  const activeLocation = useActiveLocationOptional();
  const activeLocationId = activeLocation?.activeLocationId ?? 'profile';
  const openTab = searchParams?.get('tab') === 'weekly';
  const intlDateTag = siteLocaleToIntlDateTag(_locale);

  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Valeur native du navigateur : `YYYY-Www` */
  const [weekPickerValue, setWeekPickerValue] = useState('');
  const [weekStartFilter, setWeekStartFilter] = useState('');
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    setPage(1);
  }, [weekStartFilter]);

  const canAccess = hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (activeLocationId) params.set('establishmentId', activeLocationId);
    if (weekStartFilter) {
      params.set('weekStart', weekStartFilter);
    }

    fetch(`/api/weekly-insight?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.reports ?? [];
        setReports(list);
        setTotal(typeof data.total === 'number' ? data.total : list.length);
        if (openTab && list.length > 0 && !autoExpandedRef.current) {
          setExpandedId(list[0]?.id ?? null);
          autoExpandedRef.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReports([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canAccess, activeLocationId, openTab, page, pageSize, weekStartFilter]);

  useEffect(() => {
    if (expandedId && !reports.some((r) => r.id === expandedId)) {
      setExpandedId(null);
    }
  }, [reports, expandedId]);

  if (!canAccess) return null;

  const cardClass =
    'rounded-2xl border border-white/20 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_0_24px_-8px_rgba(59,130,246,0.12)] dark:shadow-[0_0_24px_-8px_rgba(0,0,0,0.3)]';

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = Math.min(page * pageSize, total);

  return (
    <section id="weekly" className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50 flex items-center gap-2">
          <span>📊</span>
          {t('title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('intro')}{' '}
          <span className="text-slate-400 dark:text-slate-500">
            {t('introNote')}
          </span>
        </p>
      </div>

      <div className={`${cardClass} p-4 space-y-4`}>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 w-full max-w-md">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 opacity-70" />
            {t('weekLabel')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="week"
              value={weekPickerValue}
              onChange={(e) => {
                const v = e.target.value;
                setWeekPickerValue(v);
                if (!v) {
                  setWeekStartFilter('');
                  return;
                }
                const mon = isoWeekPickerToMonday(v);
                if (mon) {
                  setWeekStartFilter(mon);
                  setPage(1);
                }
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 min-w-[12rem]"
            />
            {weekStartFilter ? (
              <button
                type="button"
                onClick={() => {
                  setWeekPickerValue('');
                  setWeekStartFilter('');
                  setPage(1);
                }}
                className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
              >
                {t('showAllWeeks')}
              </button>
            ) : null}
          </div>
          {weekStartFilter ? (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('weekStarts')} {formatWeekLabel(weekStartFilter, intlDateTag)}
            </span>
          ) : null}
        </label>

        {loading ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            {t('loading')}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('empty')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              {reports.map((insight) => {
                const isExpanded = expandedId === insight.id;
                const weekLabel = formatWeekLabel(insight.week_start, intlDateTag);
                return (
                  <div key={insight.id} className="overflow-hidden bg-white/50 dark:bg-transparent">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {t('rowTitle')} {weekLabel}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          {t('ratingReviewsLine', {
                            rating: insight.avg_rating?.toFixed(1) ?? '—',
                            count: insight.total_reviews,
                            reviewsLabel: t('reviewsWord'),
                          })}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-0 space-y-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between flex-wrap gap-2 pt-4">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                            {t('ratingReviewsLine', {
                              rating: insight.avg_rating?.toFixed(1) ?? '—',
                              count: insight.total_reviews,
                              reviewsLabel: t('reviewsWord'),
                            })}
                          </p>
                        </div>

                        {insight.trend_severity != null && insight.trend_severity > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                              {t('alertLevel')}
                            </p>
                            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  (insight.trend_severity ?? 0) >= 70
                                    ? 'bg-red-500'
                                    : (insight.trend_severity ?? 0) >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, insight.trend_severity ?? 0)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {insight.full_report_json?.fullReport && (
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                              {t('detailedTitle')}
                            </p>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {insight.full_report_json.fullReport}
                            </div>
                          </div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                {t('topTitle')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{insight.top_section || '—'}</p>
                          </div>
                          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                {t('watchTitle')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {insight.watch_section || t('watchFallback')}
                            </p>
                          </div>
                          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/50 p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                {t('adviceTitle')}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {insight.advice_section || '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {total > pageSize && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('paginationRange', { from: fromIdx, to: toIdx, total })}
                  {' · '}
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
