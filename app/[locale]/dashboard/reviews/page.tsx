'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sourceFilter, setSourceFilter] = useState<ReviewSource | 'all'>('all');
  const [addForm, setAddForm] = useState({ reviewerName: '', rating: 5, comment: '', source: 'google' as string });
  const [adding, setAdding] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetch('/api/supabase/reviews')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) throw new Error(data.error ?? 'Impossible de charger les avis');
        return data;
      })
      .then((data) => {
        setReviews(data.reviews ?? []);
        setSeoKeywords(Array.isArray(data.seoKeywords) ? data.seoKeywords : []);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Impossible de charger les avis'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredReviews = useMemo(() => {
    if (sourceFilter === 'all') return reviews;
    return reviews.filter((r) => (r.source ?? 'google').toLowerCase() === sourceFilter);
  }, [reviews, sourceFilter]);

  const actionRequired = useMemo(
    () => filteredReviews.filter((r) => r.status === 'pending' || r.rating < 4),
    [filteredReviews]
  );
  const automated = useMemo(
    () => filteredReviews.filter((r) => r.status === 'scheduled' || r.status === 'generating'),
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
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: data.status ?? r.status,
                scheduled_at: data.scheduled_at ?? r.scheduled_at,
                ai_response: action === 'edit' && responseText ? responseText : r.ai_response,
                response_text: action === 'edit' && responseText ? responseText : r.response_text,
              }
            : r
        )
      );
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

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch('/api/supabase/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setReviews((prev) => [
        {
          id: data.id,
          reviewer_name: addForm.reviewerName,
          rating: addForm.rating,
          comment: addForm.comment,
          source: addForm.source,
          response_text: null,
          status: data.status,
          scheduled_at: data.scheduled_at,
          ai_response: data.ai_response,
          whatsapp_sent: false,
          quick_reply_token: data.quick_reply_token,
        },
        ...prev,
      ]);
      setAddForm({ reviewerName: '', rating: 5, comment: '', source: 'google' });
      toast.success('Avis ajouté ✅');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setAdding(false);
    }
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">Avis</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gérez vos avis et la file de publication automatique.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSourceFilter(tab.value)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              sourceFilter === tab.value
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.value !== 'all' && (
              <SourceLogo source={tab.value} className="w-4 h-4" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form add review */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display font-semibold text-lg text-slate-900 mb-4">Ajouter un avis (simulation)</h2>
        <form onSubmit={handleAddReview} className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Nom du client"
            value={addForm.reviewerName}
            onChange={(e) => setAddForm({ ...addForm, reviewerName: e.target.value })}
            required
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl border border-slate-200"
          />
          <select
            value={addForm.rating}
            onChange={(e) => setAddForm({ ...addForm, rating: Number(e.target.value) })}
            className="w-24 px-4 py-2.5 rounded-xl border border-slate-200"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}/5</option>
            ))}
          </select>
          <select
            value={addForm.source}
            onChange={(e) => setAddForm({ ...addForm, source: e.target.value })}
            className="w-36 px-4 py-2.5 rounded-xl border border-slate-200"
          >
            <option value="google">Google</option>
            <option value="tripadvisor">TripAdvisor</option>
            <option value="trustpilot">Trustpilot</option>
          </select>
          <input
            type="text"
            placeholder="Commentaire"
            value={addForm.comment}
            onChange={(e) => setAddForm({ ...addForm, comment: e.target.value })}
            required
            className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-200"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Ajouter
          </button>
        </form>
      </section>

      {/* Actions Requises */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
          🔥 Actions Requises
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Avis négatifs ou en attente de validation.
        </p>
        {actionRequired.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Aucun avis nécessitant une action.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {actionRequired.map((review) => (
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

      {/* Automatisé */}
      <section>
        <h2 className="font-display font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
          ⚙️ Automatisé
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Avis en file d&apos;attente avec heure de publication prévue.
        </p>
        {automated.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
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
      className={`rounded-2xl border p-5 shadow-sm transition-all ${
        review.rating < 4
          ? 'border-amber-200 bg-amber-50/50'
          : 'border-slate-200 bg-white'
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
            <p className="text-sm font-semibold text-slate-900">{review.reviewer_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRating rating={review.rating} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceLogo source={(review.source ?? 'google').toLowerCase()} className="w-5 h-5" />
          <span className="text-xs font-medium text-slate-500 capitalize">{review.source ?? 'google'}</span>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed mb-3">{review.comment}</p>

      {review.scheduled_at && (
        <p className="text-xs font-medium text-sky-600 mb-3">
          Publication prévue : {formatCountdown(review.scheduled_at)}
        </p>
      )}

      {(review.ai_response || review.response_text) && !isEditing && (
        <div className="mb-3">
          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
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
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
            placeholder="Réponse..."
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleEditSubmit(review.id)}
              disabled={isActing}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditId(null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="w-4 h-4" />
            Modifier la réponse
          </button>
          {(review.status === 'scheduled' || review.status === 'generating') && (
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
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50"
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
