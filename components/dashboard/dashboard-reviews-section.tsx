'use client';

import { useState, useMemo, useEffect } from 'react';
import { Zap, Shield, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StarRating } from '@/components/dashboard/star-rating';
import { AIResponseModal } from '@/components/dashboard/ai-response-modal';
import { formatDateInUserTimeZone } from '@/lib/datetime/format-dashboard-datetime';

const PAGE_SIZE = 6;

type ReviewDisplay = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt?: string;
};

type Props = {
  reviews: ReviewDisplay[];
  useSupabaseAuth: boolean;
  initialSearch?: string;
  intlLocaleTag: string;
  timeZone: string;
};

type FilterType = 'all' | 'unanswered' | 'negative';
type PlatformFilter = 'all' | 'google' | 'facebook' | 'trustpilot' | 'other';

const REVIEW_FILTER_ORDER: FilterType[] = ['all', 'unanswered', 'negative'];

const SHORT_DATE_TIME_OPTS = {
  dateStyle: 'short' as const,
  timeStyle: 'short' as const,
};

export function DashboardReviewsSection({
  reviews,
  useSupabaseAuth,
  initialSearch = '',
  intlLocaleTag,
  timeZone,
}: Props) {
  const t = useTranslations('DashboardReviews');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState(initialSearch);
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [page, setPage] = useState(1);
  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  const [modalReviewId, setModalReviewId] = useState<string | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [shieldLoading, setShieldLoading] = useState<string | null>(null);
  const [shieldMessage, setShieldMessage] = useState<string | null>(null);

  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (filter === 'unanswered') {
      list = list.filter((r) => !r.responseText && !respondedIds.has(r.id));
    } else if (filter === 'negative') {
      list = list.filter((r) => r.rating < 3);
    }
    if (platform !== 'all') {
      const p = platform;
      list = list.filter((r) => {
        const src = r.source.toLowerCase();
        if (p === 'google') return src.includes('google');
        if (p === 'facebook') return src.includes('facebook');
        if (p === 'trustpilot') return src.includes('trustpilot');
        return !src || src === 'autre' || src === 'other';
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.reviewerName.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, filter, search, platform, respondedIds]);

  const totalFiltered = filteredReviews.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [filter, platform, search]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const safePage = Math.min(page, totalPages);
  const pageStart = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, totalFiltered);

  const handleResponded = (id: string) => {
    setRespondedIds((prev) => new Set(prev).add(id));
    setModalReviewId(null);
  };

  const handleShieldReport = async (id: string) => {
    if (!useSupabaseAuth) return;
    setShieldLoading(id);
    setShieldMessage(null);
    try {
      const res = await fetch(`/api/supabase/reviews/${id}/shield-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShieldMessage(
          typeof data.error === 'string' ? data.error : t('errorReport')
        );
      } else {
        setShieldMessage(
          typeof data.message === 'string' ? data.message : t('requestSent')
        );
      }
      setTimeout(() => setShieldMessage(null), 4000);
    } catch {
      setShieldMessage(t('errorReport'));
    } finally {
      setShieldLoading(null);
    }
  };

  const displayReviews = filteredReviews.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-slate-50">{t('title')}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm sm:text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-2xl sm:rounded-lg border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-indigo-500/50 max-w-[180px]"
          />
          <div className="flex items-center gap-1">
            {REVIEW_FILTER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f
                    ? 'border-sky-500 dark:border-indigo-500 bg-sky-500 dark:bg-indigo-500 text-white'
                    : 'border-slate-200 dark:border-slate-800 dark:border-white/[0.07] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {f === 'all' ? t('filterAll') : f === 'unanswered' ? t('filterUnanswered') : t('filterNegative')}
              </button>
            ))}
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 dark:focus:ring-indigo-500/50"
          >
            <option value="all">{t('platformsAll')}</option>
            <option value="google">{t('platformGoogle')}</option>
            <option value="facebook">{t('platformFacebook')}</option>
            <option value="trustpilot">{t('platformTrustpilot')}</option>
            <option value="other">{t('platformOther')}</option>
          </select>
        </div>
      </div>

      {shieldMessage && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {shieldMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayReviews.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900 p-10 text-center shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
            <p className="text-slate-500 dark:text-slate-400">{t('noMatch')}</p>
          </div>
        ) : (
          displayReviews.map((review) => {
            const hasResponse = !!review.responseText || respondedIds.has(review.id);
            return (
              <div
                key={review.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] p-5 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-md dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{review.reviewerName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {review.createdAt
                      ? formatDateInUserTimeZone(
                          intlLocaleTag,
                          timeZone,
                          review.createdAt,
                          SHORT_DATE_TIME_OPTS
                        )
                      : t('agoShort')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-sky-50 text-sky-600 border-sky-100">
                    {review.source}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed mb-4">{review.comment}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {hasResponse ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M7 10v12" />
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                      </svg>
                      {t('responseSent')}
                    </span>
                  ) : useSupabaseAuth ? (
                    <button
                      type="button"
                      onClick={() => setModalReviewId(review.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-indigo-400 hover:text-sky-700 dark:hover:text-indigo-300"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {t('generateAI')}
                    </button>
                  ) : null}
                  {useSupabaseAuth && (
                    <button
                      type="button"
                      onClick={() => handleShieldReport(review.id)}
                      disabled={!!shieldLoading}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 disabled:opacity-60"
                    >
                      {shieldLoading === review.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      {t('shieldReport')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalFiltered > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 order-2 sm:order-1">
            {t('paginationSummary', { start: pageStart, end: pageEnd, total: totalFiltered })}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2 justify-end order-1 sm:order-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t('paginationPrev')}
              </button>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 tabular-nums px-1 min-w-[5.5rem] text-center">
                {t('paginationPageOf', { current: safePage, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('paginationNext')}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {modalReviewId && (
        <AIResponseModal
          reviewId={modalReviewId}
          reviewText={reviews.find((r) => r.id === modalReviewId)?.comment ?? ''}
          onClose={() => setModalReviewId(null)}
          onResponded={() => handleResponded(modalReviewId)}
        />
      )}
    </section>
  );
}
