'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { hasFeature, FEATURES, toPlanSlug } from '@/lib/feature-gate';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { AIResponseModal } from '@/components/dashboard/ai-response-modal';
import { StarRating } from '@/components/dashboard/star-rating';
import { Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';

type AlertReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt: string;
};

export default function AlertsPage() {
  const [planSlug, setPlanSlug] = useState<'vision' | 'pulse' | 'zenith' | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [reviews, setReviews] = useState<AlertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalReviewId, setModalReviewId] = useState<string | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan, selected_plan')
        .eq('id', user.id)
        .single();
      const slug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
      setPlanSlug(slug);

      if (slug && hasFeature(slug, FEATURES.WHATSAPP_ALERTS)) {
        const { data: supabaseReviews } = await supabase
          .from('reviews')
          .select('id, reviewer_name, rating, comment, source, response_text, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100);
        const mapped: AlertReview[] = (supabaseReviews ?? []).map((r) => ({
          id: String(r.id),
          reviewerName: String(r.reviewer_name ?? 'Client'),
          rating: typeof r.rating === 'number' ? r.rating : 0,
          comment: String(r.comment ?? ''),
          source: String(r.source ?? 'Unknown'),
          responseText: r.response_text ?? null,
          createdAt:
            typeof r.created_at === 'string' && r.created_at
              ? r.created_at
              : new Date().toISOString(),
        }));
        setReviews(mapped);
      }
      setLoading(false);
    });
  }, []);

  const canAccess = planSlug !== null && hasFeature(planSlug, FEATURES.WHATSAPP_ALERTS);

  const urgentReviews = useMemo(
    () =>
      reviews.filter(
        (r) => r.rating <= 3 && !r.responseText && !respondedIds.has(r.id),
      ),
    [reviews, respondedIds],
  );

  const handleResponded = (id: string) => {
    setRespondedIds((prev) => new Set(prev).add(id));
    setModalReviewId(null);
  };

  if (planSlug !== null && !canAccess) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50 flex items-center gap-2">
          Alertes
          <span className="text-amber-500" title="Réservé Pulse">
            🔒
          </span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Alertes WhatsApp pour avis négatifs — réservé aux membres Pulse et Zenith
        </p>
        <div className="mt-6 rounded-2xl border-2 border-amber-200 dark:border-amber-500/30 dark:border-white/[0.07] bg-amber-50/50 dark:bg-slate-900 p-10 text-center shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <p className="text-slate-700 font-medium mb-1">
            Cette fonctionnalité est réservée aux membres <strong>Pulse</strong> ou{' '}
            <strong>Zenith</strong>.
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            Recevez des alertes WhatsApp immédiates dès qu&apos;un avis négatif est détecté.
          </p>
          <button
            type="button"
            onClick={() => setShowUpgradeModal(true)}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 dark:bg-indigo-600 text-white font-semibold hover:bg-blue-700 dark:hover:bg-indigo-500 active:scale-[0.98] transition-colors"
          >
            Passer au plan Pulse
          </button>
        </div>
        {showUpgradeModal && (
          <UpgradeModal
            featureKey={FEATURES.WHATSAPP_ALERTS}
            onClose={() => setShowUpgradeModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">Alertes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Flux de crise : avis urgents à traiter en priorité
        </p>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)]">
          Chargement des alertes en cours...
        </div>
      ) : urgentReviews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-lg font-display font-semibold text-emerald-800 dark:text-emerald-100">
            Tout est sous contrôle.
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-200 mt-1">
            Aucune alerte en attente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {urgentReviews.map((r) => {
            const borderColor =
              r.rating <= 1
                ? 'border-l-red-500'
                : r.rating === 2
                  ? 'border-l-orange-400'
                  : 'border-l-amber-400';
            return (
              <div
                key={r.id}
                className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out border-l-4 ${borderColor}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {r.reviewerName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={r.rating} />
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{r.source}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-400 mb-4 leading-relaxed">
                  {r.comment}
                </p>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Avis non répondu &lt; 3★ — recommandé : répondre en priorité.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalReviewId(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 dark:bg-indigo-600 hover:bg-sky-700 dark:hover:bg-indigo-500 text-xs font-semibold text-white px-4 py-1.5 transition-colors"
                  >
                    Répondre maintenant
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalReviewId && (
        <AIResponseModal
          reviewId={modalReviewId}
          reviewText={reviews.find((r) => r.id === modalReviewId)?.comment ?? ''}
          onClose={() => setModalReviewId(null)}
          onResponded={() => handleResponded(modalReviewId)}
        />
      )}
    </div>
  );
}

