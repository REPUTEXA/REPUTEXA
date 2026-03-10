'use client';

import { useState, useMemo, useEffect } from 'react';
import { Zap, Shield, Loader2 } from 'lucide-react';
import { StarRating } from '@/components/dashboard/star-rating';
import { AIResponseModal } from '@/components/dashboard/ai-response-modal';

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
  useSupabaseAuth: boolean;
  initialSearch?: string;
};

type FilterType = 'all' | 'unanswered' | 'negative';
type PlatformFilter = 'all' | 'google' | 'tripadvisor' | 'yelp' | 'other';

export function DashboardReviewsSection({ reviews, useSupabaseAuth, initialSearch = '' }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState(initialSearch);
  const [platform, setPlatform] = useState<PlatformFilter>('all');
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
      setShieldMessage(data.message ?? 'Demande envoyée.');
      setTimeout(() => setShieldMessage(null), 4000);
    } catch {
      setShieldMessage('Erreur lors du signalement.');
    } finally {
      setShieldLoading(null);
    }
  };

  const displayReviews = filteredReviews.slice(0, 6);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display font-bold text-lg text-slate-900">Derniers avis</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <input
            type="search"
            placeholder="Rechercher par nom"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 max-w-[180px]"
          />
          <div className="flex items-center gap-1">
            {(['all', 'unanswered', 'negative'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === f
                    ? 'border-sky-500 bg-sky-500 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'unanswered' ? 'Non répondus' : 'Négatifs'}
              </button>
            ))}
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformFilter)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">Toutes plateformes</option>
            <option value="google">Google</option>
            <option value="tripadvisor">Tripadvisor</option>
            <option value="yelp">Yelp</option>
            <option value="other">Autres</option>
          </select>
        </div>
      </div>

      {shieldMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
          {shieldMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {displayReviews.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <p className="text-slate-500">
              Aucun avis ne correspond aux filtres.
            </p>
          </div>
        ) : (
          displayReviews.map((review) => {
            const hasResponse = !!review.responseText || respondedIds.has(review.id);
            return (
              <div
                key={review.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {review.reviewerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{review.reviewerName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">il y a peu</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-sky-50 text-sky-600 border-sky-100">
                    {review.source}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed mb-4">{review.comment}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {hasResponse ? (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
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
                      Réponse envoyée
                    </span>
                  ) : useSupabaseAuth ? (
                    <button
                      type="button"
                      onClick={() => setModalReviewId(review.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Générer une réponse IA
                    </button>
                  ) : null}
                  {useSupabaseAuth && (
                    <button
                      type="button"
                      onClick={() => handleShieldReport(review.id)}
                      disabled={!!shieldLoading}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 disabled:opacity-60"
                    >
                      {shieldLoading === review.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      Signaler via Bouclier IA
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

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
