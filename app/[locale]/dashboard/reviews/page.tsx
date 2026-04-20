'use client';

import { useState, useMemo, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { DashboardInlineLoading } from '@/components/dashboard/dashboard-inline-loading';
import { StarRating } from '@/components/dashboard/star-rating';
import { getSiteUrl } from '@/lib/site-url';
import { SourceLogo } from '@/components/dashboard/source-logo';
import { Loader2, Pencil, Send, XCircle, ChevronLeft, ChevronRight, Search, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveLocationOptional } from '@/lib/active-location-context';

type ReviewSource = 'google' | 'facebook' | 'trustpilot';

/** Slug plateforme par défaut pour logo / filtre (identifiant technique). */
const DEFAULT_REVIEW_SOURCE_SLUG = 'google' as const;

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
  whatsapp_sent: boolean;
  quick_reply_token: string | null;
  is_toxic?: boolean;
};

function isSeoBoosted(text: string | null, keywords: string[]): boolean {
  if (!text || !keywords.length) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
}

const QUEUE_PAGE_SIZE = 6;
const PUBLISHED_PAGE_SIZE = 8;

export default function ReviewsPage() {
  const tr = useTranslations('Dashboard.reviewsPage');
  const locale = useLocale();
  const formatCountdown = (scheduledAt: string): string => {
    const then = new Date(scheduledAt).getTime();
    const now = Date.now();
    const diff = then - now;
    if (diff <= 0) return tr('countdownPublished');
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return tr('countdownIn', { hours: h, minutes: m });
    return tr('countdownInMinutes', { minutes: m });
  };
  const activeLocation = useActiveLocationOptional();
  const locationKey = activeLocation?.activeLocationId ?? 'profile';

  const [actingId, setActingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ReviewSource | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [queuePage, setQueuePage] = useState(1);
  const [publishedPage, setPublishedPage] = useState(1);

  const [queueTick, setQueueTick] = useState(0);

  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['reviews', locationKey],
    queryFn: async () => {
      const r = await fetch('/api/supabase/reviews');
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? tr('loadError'));
      return data;
    },
    refetchInterval: 45000,
  });

  const hasPublicationQueue = useMemo(
    () =>
      (data?.reviews ?? []).some(
        (r: Review) =>
          r.status === 'scheduled' ||
          r.status === 'generating' ||
          r.status === 'pending_publication' ||
          r.status === 'pending'
      ),
    [data?.reviews]
  );

  useEffect(() => {
    if (!hasPublicationQueue) return;
    const id = window.setInterval(() => setQueueTick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, [hasPublicationQueue]);

  void queueTick;

  const reviews = useMemo(() => (data?.reviews ?? []) as Review[], [data?.reviews]);
  const seoKeywords = Array.isArray(data?.seoKeywords) ? data.seoKeywords : [];
  const loading = queryLoading;

  const filteredReviews = useMemo(() => {
    const base =
      sourceFilter === 'all'
        ? reviews
        : reviews.filter((r) => (r.source ?? DEFAULT_REVIEW_SOURCE_SLUG).toLowerCase() === sourceFilter);
    // Reviews flagged TOXIC are handled under Alerts only.
    return base.filter((r) => !r.is_toxic);
  }, [reviews, sourceFilter]);

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredReviews;
    return filteredReviews.filter(
      (r) =>
        (r.reviewer_name ?? '').toLowerCase().includes(q) ||
        (r.comment ?? '').toLowerCase().includes(q)
    );
  }, [filteredReviews, searchQuery]);

  const queueList = useMemo(() => {
    const list = searchFiltered.filter(
      (r) =>
        r.status === 'scheduled' ||
        r.status === 'generating' ||
        r.status === 'pending_publication' ||
        r.status === 'pending'
    );
    return [...list].sort((a, b) => {
      const sa = a.scheduled_at ? new Date(a.scheduled_at).getTime() : null;
      const sb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : null;
      if (sa != null && sb != null && sa !== sb) return sa - sb;
      if (sa != null && sb == null) return -1;
      if (sa == null && sb != null) return 1;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [searchFiltered]);

  const publishedList = useMemo(
    () =>
      [...searchFiltered.filter((r) => r.status === 'published')].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      ),
    [searchFiltered]
  );

  const queueTotalPages = Math.max(1, Math.ceil(queueList.length / QUEUE_PAGE_SIZE));
  const safeQueuePage = Math.min(queuePage, queueTotalPages);
  const queuePageSlice = useMemo(
    () =>
      queueList.slice((safeQueuePage - 1) * QUEUE_PAGE_SIZE, safeQueuePage * QUEUE_PAGE_SIZE),
    [queueList, safeQueuePage]
  );

  const publishedTotalPages = Math.max(1, Math.ceil(publishedList.length / PUBLISHED_PAGE_SIZE));
  const safePublishedPage = Math.min(publishedPage, publishedTotalPages);
  const publishedPageSlice = useMemo(
    () =>
      publishedList.slice(
        (safePublishedPage - 1) * PUBLISHED_PAGE_SIZE,
        safePublishedPage * PUBLISHED_PAGE_SIZE
      ),
    [publishedList, safePublishedPage]
  );

  useEffect(() => {
    setQueuePage(1);
    setPublishedPage(1);
  }, [sourceFilter, locationKey, searchQuery]);

  useEffect(() => {
    setQueuePage((p) => Math.min(p, queueTotalPages));
  }, [queueTotalPages]);

  useEffect(() => {
    setPublishedPage((p) => Math.min(p, publishedTotalPages));
  }, [publishedTotalPages]);

  const runAction = async (
    id: string,
    action: 'publish_now' | 'cancel' | 'edit' | 'delay',
    responseText?: string,
    extraMinutes?: number
  ) => {
    setActingId(id);
    try {
      const body: { action: string; responseText?: string; extraMinutes?: number } = { action };
      if (action === 'edit' && responseText) body.responseText = responseText;
      if (action === 'delay' && extraMinutes != null) body.extraMinutes = extraMinutes;
      const res = await fetch(`/api/supabase/reviews/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tr('errorGeneric'));
      await refetch();
      setEditId(null);
      if (action === 'publish_now') toast.success(tr('toastPublished'));
      else if (action === 'cancel') toast.success(tr('toastCancelled'));
      else if (action === 'edit') toast.success(tr('toastEdited'));
      else if (action === 'delay') toast.success(tr('toastDelayed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tr('errorGeneric'));
    } finally {
      setActingId(null);
    }
  };

  const handleEditSubmit = (id: string) => {
    if (!editText.trim()) return;
    runAction(id, 'edit', editText);
  };

  const isBoosted = (r: Review) =>
    isSeoBoosted(r.response_text || r.ai_response, seoKeywords);

  const quickReplyUrl = (r: Review) => {
    if (!r.quick_reply_token) return null;
    const base = getSiteUrl();
    return `${base}/${locale}/quick-reply/${r.id}?t=${r.quick_reply_token}`;
  };

  const SOURCE_TABS: { value: ReviewSource | 'all'; label: string }[] = [
    { value: 'all', label: tr('tabAll') },
    { value: 'google', label: tr('tabGoogle') },
    { value: 'facebook', label: tr('tabFacebook') },
    { value: 'trustpilot', label: tr('tabTrustpilot') },
  ];

  if (loading) {
    return <DashboardInlineLoading />;
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100">{tr('pageTitle')}</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          {tr('pageSubtitle')}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/80 dark:bg-sky-950/25 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 space-y-2 text-sm text-slate-700 dark:text-zinc-300">
            <p className="font-semibold text-slate-900 dark:text-zinc-100">{tr('explainerTitle')}</p>
            <ul className="list-disc pl-4 space-y-1.5 marker:text-sky-600 dark:marker:text-sky-400">
              <li>{tr('explainerItem1')}</li>
              <li>{tr('explainerItem2')}</li>
              <li>{tr('explainerItem3')}</li>
              <li>{tr('explainerItem4')}</li>
              <li>{tr('explainerItem5')}</li>
              <li>{tr('explainerItem6')}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr('searchPlaceholder')}
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSourceFilter(tab.value)}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 ease-in-out ${
              sourceFilter === tab.value
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700/50'
            }`}
          >
            {tab.value !== 'all' && (
              <SourceLogo source={tab.value} className="w-4 h-4" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Publication queue (human-like delay) */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          {tr('queueSectionTitle')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          {tr('queueSectionDesc')}
        </p>
        {queueList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            {tr('queueEmpty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {queuePageSlice.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  actingId={actingId}
                  editId={editId}
                  editText={editText}
                  setEditId={setEditId}
                  setEditText={setEditText}
                  runAction={runAction}
                  handleEditSubmit={handleEditSubmit}
                  quickReplyUrl={quickReplyUrl(review)}
                  formatCountdown={formatCountdown}
                  isSeoBoosted={isBoosted(review)}
                />
              ))}
            </div>
            {queueTotalPages > 1 ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <span>
                  {tr('paginationRange', {
                    from: (safeQueuePage - 1) * QUEUE_PAGE_SIZE + 1,
                    to: Math.min(safeQueuePage * QUEUE_PAGE_SIZE, queueList.length),
                    total: queueList.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                    disabled={safeQueuePage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {tr('paginationPrev')}
                  </button>
                  <span className="tabular-nums px-2">
                    {safeQueuePage} / {queueTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQueuePage((p) => Math.min(queueTotalPages, p + 1))}
                    disabled={safeQueuePage >= queueTotalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    {tr('paginationNext')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Published */}
      <section className="pt-2">
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          {tr('publishedTitle')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          {tr('publishedDesc')}
        </p>
        {publishedList.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            {tr('publishedEmpty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {publishedPageSlice.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  actingId={actingId}
                  editId={editId}
                  editText={editText}
                  setEditId={setEditId}
                  setEditText={setEditText}
                  runAction={runAction}
                  handleEditSubmit={handleEditSubmit}
                  quickReplyUrl={quickReplyUrl(review)}
                  formatCountdown={formatCountdown}
                  isSeoBoosted={isBoosted(review)}
                />
              ))}
            </div>
            {publishedTotalPages > 1 ? (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <span>
                  {tr('paginationRange', {
                    from: (safePublishedPage - 1) * PUBLISHED_PAGE_SIZE + 1,
                    to: Math.min(safePublishedPage * PUBLISHED_PAGE_SIZE, publishedList.length),
                    total: publishedList.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishedPage((p) => Math.max(1, p - 1))}
                    disabled={safePublishedPage <= 1}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {tr('paginationPrev')}
                  </button>
                  <span className="tabular-nums px-2">
                    {safePublishedPage} / {publishedTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPublishedPage((p) => Math.min(publishedTotalPages, p + 1))}
                    disabled={safePublishedPage >= publishedTotalPages}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-3 py-1.5 font-medium text-slate-700 dark:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    {tr('paginationNext')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

type ReviewCardProps = {
  review: Review;
  actingId: string | null;
  editId: string | null;
  editText: string;
  setEditId: (id: string | null) => void;
  setEditText: (t: string) => void;
  runAction: (
    id: string,
    action: 'publish_now' | 'cancel' | 'edit' | 'delay',
    responseText?: string,
    extraMinutes?: number
  ) => Promise<void>;
  handleEditSubmit: (id: string) => void;
  quickReplyUrl: string | null;
  formatCountdown: (s: string) => string;
  isSeoBoosted: boolean;
};

function ReviewCard({
  review,
  actingId,
  editId,
  editText,
  setEditId,
  setEditText,
  runAction,
  handleEditSubmit,
  quickReplyUrl,
  formatCountdown,
  isSeoBoosted,
}: ReviewCardProps) {
  const tr = useTranslations('Dashboard.reviewsPage');
  const isEditing = editId === review.id;
  const isActing = actingId === review.id;
  const inPublicationQueue =
    review.status === 'scheduled' ||
    review.status === 'generating' ||
    review.status === 'pending_publication';
  const canDelay = Boolean(review.scheduled_at) && inPublicationQueue;
  const canPublishOrCancel =
    review.status === 'pending' || inPublicationQueue;
  const hasReplyText = Boolean((review.response_text || review.ai_response)?.trim());

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm dark:shadow-none transition-all ${
        review.rating < 4
          ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/30'
          : 'border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
              review.rating >= 4
                ? 'bg-gradient-to-br from-sky-500 to-indigo-500'
                : 'bg-gradient-to-br from-amber-500 to-orange-500'
            }`}
          >
            {review.reviewer_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{review.reviewer_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceLogo source={(review.source ?? DEFAULT_REVIEW_SOURCE_SLUG).toLowerCase()} className="w-5 h-5" />
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 capitalize">{review.source ?? DEFAULT_REVIEW_SOURCE_SLUG}</span>
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed mb-3">{review.comment}</p>

      {review.scheduled_at && (
        <p className="text-xs font-medium text-sky-600 mb-3">
          {tr('publicationScheduled', { time: formatCountdown(review.scheduled_at) })}
        </p>
      )}

      {(review.ai_response || review.response_text) && !isEditing && (
        <div className="mb-3">
          <p className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/80 rounded-lg p-2">
            {review.response_text || review.ai_response}
          </p>
          {isSeoBoosted && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-emerald-600">
              {tr('seoBoostBadge')}
            </span>
          )}
        </div>
      )}

      {isEditing ? (
        <div className="space-y-2 mb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            placeholder={tr('placeholderResponse')}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleEditSubmit(review.id)}
              disabled={isActing}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 disabled:opacity-50"
            >
              {tr('save')}
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-sm hover:bg-slate-50 dark:hover:bg-zinc-700/50"
            >
              {tr('cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditId(review.id);
              setEditText(review.ai_response || review.response_text || '');
            }}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-zinc-700/50 border border-slate-200 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-600/50"
          >
            <Pencil className="w-4 h-4" />
            {tr('editResponse')}
          </button>
          {canPublishOrCancel && (
            <>
              <button
                type="button"
                onClick={() => runAction(review.id, 'publish_now')}
                disabled={isActing || !hasReplyText}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {tr('publishNow')}
              </button>
              {inPublicationQueue ? (
                <button
                  type="button"
                  onClick={() => runAction(review.id, 'cancel')}
                  disabled={isActing}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <XCircle className="w-4 h-4" />
                  {tr('cancelScheduled')}
                </button>
              ) : null}
            </>
          )}
          {canDelay ? (
            <>
              <button
                type="button"
                onClick={() => runAction(review.id, 'delay', undefined, 60)}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                {tr('delay1h')}
              </button>
              <button
                type="button"
                onClick={() => runAction(review.id, 'delay', undefined, 120)}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                {tr('delay2h')}
              </button>
            </>
          ) : null}
          {quickReplyUrl && (
            <a
              href={quickReplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-sky-600 hover:bg-sky-50"
            >
              {tr('quickLink')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
