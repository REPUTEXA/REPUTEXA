'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StarRating } from '@/components/dashboard/star-rating';
import { getSiteUrl } from '@/lib/site-url';
import { SourceLogo } from '@/components/dashboard/source-logo';
import { Loader2, Pencil, Send, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type ReviewSource = 'google' | 'tripadvisor' | 'trustpilot';

type Review = {
  id: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  source: string;
  response_text: string | null;
  status: string;
  scheduled_at: string | null;
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

function formatCountdown(scheduledAt: string): string {
  const then = new Date(scheduledAt).getTime();
  const now = Date.now();
  const diff = then - now;
  if (diff <= 0) return 'Publié';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `dans ${h}h ${m}min`;
  return `dans ${m}min`;
}

export default function ReviewsPage() {
  const [actingId, setActingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ReviewSource | 'all'>('all');

  const { data, isLoading: queryLoading, refetch } = useQuery({
    queryKey: ['reviews'],
    queryFn: async () => {
      const r = await fetch('/api/supabase/reviews');
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? 'Impossible de charger les avis');
      return data;
    },
    refetchInterval: 60000,
  });

  const reviews = (data?.reviews ?? []) as Review[];
  const seoKeywords = Array.isArray(data?.seoKeywords) ? data.seoKeywords : [];
  const loading = queryLoading;

  const filteredReviews = useMemo(() => {
    const base =
      sourceFilter === 'all'
        ? reviews
        : reviews.filter((r) => (r.source ?? 'google').toLowerCase() === sourceFilter);
    // Les avis marqués comme TOXIC sont gérés dans la section "Alertes" uniquement.
    return base.filter((r) => !r.is_toxic);
  }, [reviews, sourceFilter]);

  const automated = useMemo(
    () => filteredReviews.filter((r) => r.status === 'scheduled' || r.status === 'generating' || r.status === 'pending_publication'),
    [filteredReviews]
  );

  const runAction = async (
    id: string,
    action: 'publish_now' | 'cancel' | 'edit',
    responseText?: string
  ) => {
    setActingId(id);
    try {
      const body: { action: string; responseText?: string } = { action };
      if (action === 'edit' && responseText) body.responseText = responseText;
      const res = await fetch(`/api/supabase/reviews/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      await refetch();
      setEditId(null);
      if (action === 'publish_now') toast.success('Réponse publiée ✅');
      else if (action === 'cancel') toast.success('Publication annulée');
      else if (action === 'edit') toast.success('Réponse modifiée ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
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
    const loc = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] ?? 'fr' : 'fr';
    return `${base}/${loc}/quick-reply/${r.id}?t=${r.quick_reply_token}`;
  };

  const SOURCE_TABS: { value: ReviewSource | 'all'; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'google', label: 'Google' },
    { value: 'tripadvisor', label: 'TripAdvisor' },
    { value: 'trustpilot', label: 'Trustpilot' },
  ];

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100">Avis</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Gérez vos avis et la file de publication automatique.
        </p>
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

      {/* Automatisé */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          ⚙️ Automatisé
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          Avis en file d&apos;attente avec heure de publication prévue.
        </p>
        {automated.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            Aucun avis en file automatique.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {automated.map((review) => (
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
  runAction: (id: string, action: 'publish_now' | 'cancel' | 'edit', responseText?: string) => Promise<void>;
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
  const isEditing = editId === review.id;
  const isActing = actingId === review.id;

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
          <SourceLogo source={(review.source ?? 'google').toLowerCase()} className="w-5 h-5" />
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 capitalize">{review.source ?? 'google'}</span>
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed mb-3">{review.comment}</p>

      {review.scheduled_at && (
        <p className="text-xs font-medium text-sky-600 mb-3">
          Publication prévue : {formatCountdown(review.scheduled_at)}
        </p>
      )}

      {(review.ai_response || review.response_text) && !isEditing && (
        <div className="mb-3">
          <p className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/80 rounded-lg p-2">
            {review.response_text || review.ai_response}
          </p>
          {isSeoBoosted && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-emerald-600">
              🚀 Boosté
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
            placeholder="Réponse..."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleEditSubmit(review.id)}
              disabled={isActing}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:brightness-110 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 text-sm hover:bg-slate-50 dark:hover:bg-zinc-700/50"
            >
              Annuler
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
            Modifier la réponse
          </button>
          {(review.status === 'scheduled' || review.status === 'generating' || review.status === 'pending_publication') && (
            <>
              <button
                type="button"
                onClick={() => runAction(review.id, 'publish_now')}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publier maintenant
              </button>
              <button
                type="button"
                onClick={() => runAction(review.id, 'cancel')}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <XCircle className="w-4 h-4" />
                Annuler
              </button>
            </>
          )}
          {quickReplyUrl && (
            <a
              href={quickReplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-sky-600 hover:bg-sky-50"
            >
              Lien rapide →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
