'use client';

import { useTranslations } from 'next-intl';
import { useState, useMemo, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { StarRating } from '@/components/dashboard/star-rating';
import { EmptyStateIllustration } from '@/components/dashboard/empty-state-illustration';

type ReviewDisplay = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
};

type Props = {
  reviews: ReviewDisplay[];
  useSupabaseAuth?: boolean;
  initialSearch?: string;
};

type FilterType = 'all' | 'unanswered' | 'negative';
type PlatformFilter = 'all' | 'google' | 'tripadvisor' | 'yelp' | 'other';

export function DashboardReviewsSection({ reviews, initialSearch = '' }: Props) {
  const t = useTranslations('DashboardReviews');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState(initialSearch);
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  const [respondedIds] = useState<Set<string>>(new Set());

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
        if (p === 'tripadvisor') return src.includes('trip') || src.includes('advisor');
        if (p === 'yelp') return src.includes('yelp');
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

  const displayReviews = filteredReviews.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-zinc-100">{t('title')}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm sm:text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-2xl sm:rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 dark:focus:ring-indigo-500/50 max-w-[180px]"
          />
          <div className="flex items-center gap-1">
            {(['all', 'unanswered', 'negative'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-xs font-medium min-h-[44px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-xl border transition-all duration-300 ease-in-out ${
                  filter === f
                    ? 'border-sky-500 dark:border-indigo-500 bg-sky-500 dark:bg-indigo-500 text-white'
                    : 'border-slate-200 dark:border-zinc-800/50 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {f === 'all' ? t('filterAll') : f === 'unanswered' ? t('filterUnanswered') : t('filterNegative')}
              </button>
            ))}
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] text-slate-700 dark:text-zinc-100 dark:focus:ring-indigo-500/50"
          >
            <option value="all">{t('platformsAll')}</option>
            <option value="google">Google</option>
            <option value="tripadvisor">Tripadvisor</option>
            <option value="yelp">Yelp</option>
            <option value="other">Autres</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayReviews.length === 0 ? (
          reviews.length === 0 ? (
            <div className="col-span-2">
              <EmptyStateIllustration
                title={t('emptyTitle') ?? "Aucun avis pour l'instant"}
                description={t('emptyDesc') ?? "Connectez votre établissement Google pour importer vos avis et générer vos premières réponses IA."}
                action={
                  <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 transition-all shadow-lg shadow-[#2563eb]/20"
                  >
                    🚀 Connecter mon établissement
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] p-10 text-center shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
              <p className="text-slate-500 dark:text-zinc-400">{t('noMatch')}</p>
            </div>
          )
        ) : (
          displayReviews.map((review) => {
            const hasResponse = !!review.responseText || respondedIds.has(review.id);
            return (
              <div
                key={review.id}
                className="bg-white dark:bg-[#09090b] rounded-2xl border border-slate-200 dark:border-zinc-800/50 p-5 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-md dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{review.reviewerName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-zinc-500">il y a peu</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-500/30">
                    {review.source}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-zinc-400 leading-relaxed mb-4">{review.comment}</p>
                {hasResponse && (
                  <div className="flex items-center gap-3 flex-wrap">
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
