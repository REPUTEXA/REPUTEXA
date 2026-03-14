'use client';

import { useState, useEffect, useMemo } from 'react';
import { StarRating } from '@/components/dashboard/star-rating';
import { SourceLogo } from '@/components/dashboard/source-logo';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

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
const PAGE_SIZE = 10;

function formatCountdown(scheduledAt: string): string {
  const then = new Date(scheduledAt).getTime();
  const now = Date.now();
  const diff = then - now;
  if (diff <= 0) return 'Publication imminente';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `dans ${h}h ${m}min`;
  return `dans ${m}min`;
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResponsesPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    fetch('/api/supabase/reviews')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.error) throw new Error(data.error ?? 'Impossible de charger les avis');
        return data;
      })
      .then((data) => setReviews(data.reviews ?? []))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false));
  }, []);

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

  useEffect(() => {
    const interval = setInterval(
      () =>
        fetch('/api/supabase/reviews')
          .then((r) => r.json().catch(() => ({})))
          .then((data) => setReviews(data.reviews ?? [])),
      60000
    );
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="px-4 sm:px-6 py-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100">
          Réponses IA
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          File d&apos;attente et historique des avis publiés
        </p>
      </div>

      {/* En attente (Automatisé) */}
      <section>
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          ⏳ En attente
        </h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
          Avis en file d&apos;attente avant publication automatique.
        </p>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            Aucun avis en attente.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pending.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/50 p-5 shadow-sm dark:shadow-none"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-700">
                    <SourceLogo source={(r.source ?? 'google').toLowerCase()} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                        {r.reviewer_name}
                      </p>
                      <StarRating rating={r.rating} />
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 capitalize">
                      {(r.source ?? 'google').toLowerCase()}
                    </span>
                    <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300 line-clamp-2">
                      {r.comment}
                    </p>
                    {r.scheduled_at && (
                      <p className="mt-2 text-xs font-medium text-sky-600 dark:text-sky-400">
                        Publication prévue : {formatCountdown(r.scheduled_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historique - Avis publiés */}
      <section>
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
          ✅ Avis publiés
        </h2>
        {published.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-800/30 p-8 text-center text-slate-500 dark:text-zinc-400">
            Aucun avis dans l&apos;historique.
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
                      <SourceLogo source={(r.source ?? 'google').toLowerCase()} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {r.reviewer_name}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Publié
                          </span>
                          <StarRating rating={r.rating} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        Publié le {formatDate(r.created_at)}
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

            {/* Pagination */}
            {totalHistoryPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>
                <span className="text-sm text-slate-600 dark:text-zinc-400">
                  Page {historyPage} / {totalHistoryPages}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage >= totalHistoryPages}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Suivant
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
