'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { StarRating } from '@/components/dashboard/star-rating';
import { SourceLogo } from '@/components/dashboard/source-logo';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveLocationOptional } from '@/lib/active-location-context';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  source: string;
  response_text: string | null;
  status: string;
  scheduled_at: string | null;
  created_at?: string;
  ai_response: string | null;
  is_toxic?: boolean;
};

const PENDING_STATUSES = ['pending', 'generating', 'scheduled', 'pending_publication'];
/** Slug plateforme par défaut pour SourceLogo (identifiant technique, hors JSX). */
const DEFAULT_REVIEW_SOURCE_SLUG = 'google' as const;
const PAGE_SIZE = 10;
const PENDING_PAGE_SIZE = 6;

export default function ResponsesPage() {
  const locale = useLocale();
  const t = useTranslations('Dashboard.responsesPage');
  const intlTag = siteLocaleToIntlDateTag(locale);
  const activeLocation = useActiveLocationOptional();
  const locationKey = activeLocation?.activeLocationId ?? 'profile';

  const formatDate = (iso: string | undefined) => {
    if (!iso) return t('datePlaceholder');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return t('datePlaceholder');
    return d.toLocaleDateString(intlTag, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCountdown = (scheduledAt: string) => {
    const then = new Date(scheduledAt).getTime();
    const now = Date.now();
    const diff = then - now;
    if (diff <= 0) return t('countdownImminent');
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return t('countdownHoursMinutes', { hours: h, minutes: m });
    return t('countdownMinutes', { minutes: m });
  };

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/supabase/reviews')
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok || data.error) throw new Error(data.error ?? t('loadError'));
          return data;
        })
        .then((data) => {
          if (!cancelled) setReviews(data.reviews ?? []);
        })
        .catch((err) => {
          if (!cancelled) toast.error(err instanceof Error ? err.message : t('toastError'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    setLoading(true);
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t bound to locale via next-intl
  }, [locationKey, locale]);

  const pending = useMemo(
    () => reviews.filter((r) => PENDING_STATUSES.includes(r.status) && !r.is_toxic),
    [reviews]
  );
  const published = useMemo(
    () =>
      reviews
        .filter((r) => r.status === 'published' && !r.is_toxic)
        .sort((a, b) => {
          const da = new Date(a.created_at ?? 0).getTime();
          const db = new Date(b.created_at ?? 0).getTime();
          return db - da;
        }),
    [reviews]
  );

  const totalHistoryPages = Math.max(1, Math.ceil(published.length / PAGE_SIZE));
  const paginatedPublished = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return published.slice(start, start + PAGE_SIZE);
  }, [published, historyPage]);

  const totalPendingPages = Math.max(1, Math.ceil(pending.length / PENDING_PAGE_SIZE));
  const safePendingPage = Math.min(pendingPage, totalPendingPages);
  const paginatedPending = useMemo(() => {
    const start = (safePendingPage - 1) * PENDING_PAGE_SIZE;
    return pending.slice(start, start + PENDING_PAGE_SIZE);
  }, [pending, safePendingPage]);

  useEffect(() => {
    setPendingPage(1);
  }, [locationKey]);

  useEffect(() => {
    setPendingPage((p) => Math.min(p, totalPendingPages));
  }, [totalPendingPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [locationKey]);

  useEffect(() => {
    setHistoryPage((p) => Math.min(p, totalHistoryPages));
  }, [totalHistoryPages]);

  if (loading) {
    return <DashboardInlineLoading />;
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">{t('subtitle')}</p>
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          ⏳ {t('pendingTitle')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{t('pendingSubtitle')}</p>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            {t('pendingEmpty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedPending.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/50 p-5 shadow-sm dark:shadow-none"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-700">
                      <SourceLogo source={(r.source ?? DEFAULT_REVIEW_SOURCE_SLUG).toLowerCase()} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {r.reviewer_name}
                        </p>
                        <StarRating rating={r.rating} />
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 capitalize">
                        {(r.source ?? DEFAULT_REVIEW_SOURCE_SLUG).toLowerCase()}
                      </span>
                      <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300 line-clamp-2">
                        {r.comment}
                      </p>
                      {r.scheduled_at && (
                        <p className="mt-2 text-xs font-medium text-sky-600 dark:text-sky-400">
                          {t('scheduledFor', { countdown: formatCountdown(r.scheduled_at) })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPendingPages > 1 ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <span>
                  {t('rangeOfTotal', {
                    from: (safePendingPage - 1) * PENDING_PAGE_SIZE + 1,
                    to: Math.min(safePendingPage * PENDING_PAGE_SIZE, pending.length),
                    total: pending.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    disabled={safePendingPage <= 1}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {t('prev')}
                  </button>
                  <span className="tabular-nums">
                    {safePendingPage} / {totalPendingPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingPage((p) => Math.min(totalPendingPages, p + 1))}
                    disabled={safePendingPage >= totalPendingPages}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    {t('next')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          ✅ {t('publishedTitle')}
        </h2>
        {published.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            {t('historyEmpty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginatedPublished.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/50 p-5 shadow-sm dark:shadow-none"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-700">
                      <SourceLogo source={(r.source ?? DEFAULT_REVIEW_SOURCE_SLUG).toLowerCase()} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {r.reviewer_name}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            {t('badgePublished')}
                          </span>
                          <StarRating rating={r.rating} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        {t('publishedAt', { date: formatDate(r.created_at) })}
                      </span>
                      <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300 line-clamp-2">
                        {r.comment}
                      </p>
                      {(r.response_text || r.ai_response) && (
                        <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/80 rounded-lg p-2 line-clamp-2">
                          {r.response_text || r.ai_response}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalHistoryPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('prev')}
                </button>
                <span className="text-sm text-slate-600 dark:text-zinc-400">
                  {t('pageOfTotal', { page: historyPage, total: totalHistoryPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage >= totalHistoryPages}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {t('next')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
