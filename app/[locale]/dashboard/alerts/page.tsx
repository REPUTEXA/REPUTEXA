'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasFeature, FEATURES, toPlanSlug, type PlanSlug } from '@/lib/feature-gate';
import { useActiveLocation } from '@/lib/active-location-context';
import { UpgradeModal } from '@/components/dashboard/upgrade-modal';
import { AIResponseModal } from '@/components/dashboard/ai-response-modal';
import { StarRating } from '@/components/dashboard/star-rating';
import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { toast } from 'sonner';

type AlertReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt: string;
  isToxic: boolean;
  toxicityReason?: string | null;
  toxicityComplaintText?: string | null;
  toxicityLegalArgumentation?: string | null;
  resolved: boolean;
};

function getReportInfo(source: string): { url: string; label: string } {
  const n = (source ?? '').toLowerCase();
  if (n.includes('google')) return { url: 'https://support.google.com/business/answer/4596773?hl=fr', label: 'Google' };
  if (n.includes('tripadvisor')) return { url: 'https://www.tripadvisor.fr/OwnerSupport', label: 'TripAdvisor' };
  if (n.includes('trustpilot')) return { url: 'https://support.trustpilot.com/hc/fr/articles/201839903-Comment-signaler-un-avis', label: 'Trustpilot' };
  return { url: 'https://support.google.com/business/answer/4596773?hl=fr', label: 'la plateforme' };
}

export default function AlertsPage() {
  const searchParams = useSearchParams();
  const { activeLocationId } = useActiveLocation();
  const highlightedId = searchParams?.get('id') ?? null;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [planSlug, setPlanSlug] = useState<PlanSlug | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [reviews, setReviews] = useState<AlertReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalReviewId, setModalReviewId] = useState<string | null>(null);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const [removalInProgressId, setRemovalInProgressId] = useState<string | null>(null);
  const [removalStep, setRemovalStep] = useState<number>(0);
  const timeoutsRef = useRef<number[]>([]);

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

      let query = supabase
        .from('reviews')
        .select(
          'id, reviewer_name, rating, comment, source, response_text, created_at, is_toxic, toxicity_reason, toxicity_complaint_text, toxicity_legal_argumentation, toxicity_resolved_at'
        )
        .eq('user_id', user.id)
        .eq('is_toxic', true);
      if (activeLocationId === 'profile') {
        query = query.is('establishment_id', null);
      } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
        query = query.eq('establishment_id', activeLocationId);
      }
      const { data: supabaseReviews } = await query
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
        isToxic: Boolean(r.is_toxic),
        toxicityReason: (r.toxicity_reason as string | null) ?? null,
        toxicityComplaintText: (r.toxicity_complaint_text as string | null) ?? null,
        toxicityLegalArgumentation: (r.toxicity_legal_argumentation as string | null) ?? null,
        resolved: Boolean(r.toxicity_resolved_at),
      }));
      setReviews(mapped);
      setLoading(false);
    });
  }, [activeLocationId]);

  // Deep-link : scroll et pulse sur l'avis ciblé par ?id=
  useEffect(() => {
    if (!highlightedId || loading) return;
    const t = window.setTimeout(() => {
      const el = cardRefs.current[highlightedId];
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-pulse');
      window.setTimeout(() => el.classList.remove('animate-pulse'), 2500);
    }, 150);
    return () => clearTimeout(t);
  }, [highlightedId, loading]);

  const hasShield = planSlug !== null && hasFeature(planSlug, FEATURES.SHIELD_HATEFUL);

  const urgentReviews = useMemo(
    () =>
      reviews.filter(
        (r) => r.isToxic && !r.resolved && !respondedIds.has(r.id),
      ),
    [reviews, respondedIds],
  );

  const handleResponded = (id: string) => {
    setRespondedIds((prev) => new Set(prev).add(id));
    setModalReviewId(null);
  };

  const handleStartRemoval = async (review: AlertReview) => {
    if (!hasShield) {
      setShowUpgradeModal(true);
      return;
    }
    if (removalInProgressId === review.id) return;

    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];

    setRemovalInProgressId(review.id);
    setRemovalStep(0);

    const t1 = window.setTimeout(() => setRemovalStep(1), 1000);
    const t2 = window.setTimeout(() => setRemovalStep(2), 2000);
    const t3 = window.setTimeout(() => {
      (async () => {
        const dossierText =
          review.toxicityLegalArgumentation ||
          review.toxicityComplaintText ||
          review.toxicityReason ||
          'Avis toxique — suppression demandée.';
        const { url: reportUrl } = getReportInfo(review.source);

        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          try {
            await navigator.clipboard.writeText(dossierText);
          } catch {
            /* ignore */
          }
        }
        if (typeof window !== 'undefined') {
          window.open(reportUrl, '_blank', 'noopener,noreferrer');
        }
        toast.success('Dossier copié et transmis ! Collez-le dans le formulaire qui vient de s\'ouvrir.');

        try {
          const supabase = createClient();
          await supabase
            .from('reviews')
            .update({ toxicity_resolved_at: new Date().toISOString() })
            .eq('id', review.id);
          setReviews((prev) =>
            prev.map((r) => (r.id === review.id ? { ...r, resolved: true } : r))
          );
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('toxic-alert-resolved'));
          }
        } catch {
          toast.error('Erreur lors de la finalisation.');
        } finally {
          setRemovalInProgressId(null);
          setRemovalStep(0);
        }
      })();
    }, 3000);

    timeoutsRef.current = [t1, t2, t3];
  };

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">Alertes</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bouclier IA : avis toxiques détectés (haine, doxxing, spam, conflit d&apos;intérêt)
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
        <div className="space-y-4">
          {urgentReviews.map((r) => {
            const sourceLabel = getReportInfo(r.source).label;
            const borderColor =
              r.rating <= 1 ? 'border-l-red-500' : r.rating === 2 ? 'border-l-orange-400' : 'border-l-amber-400';
            const legalText = r.toxicityLegalArgumentation || r.toxicityComplaintText;
            const isHighlighted = highlightedId === r.id;
            return (
              <div
                key={r.id}
                ref={(el) => { cardRefs.current[r.id] = el; }}
                className={`rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] p-5 transition-all duration-300 border-l-4 ${borderColor}${isHighlighted ? ' ring-2 ring-red-400/50 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{r.reviewerName}</p>
                        <span className="inline-flex items-center rounded-md bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Toxic</span>
                      </div>
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
                <p className="text-sm text-slate-700 dark:text-slate-400 mb-3 leading-relaxed">{r.comment}</p>

                {legalText && !(removalInProgressId === r.id) && (
                  <div className="mb-4 rounded-xl border-2 border-blue-200 dark:border-blue-900/60 bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div className="flex items-start gap-2">
                      <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {legalText}
                      </p>
                    </div>
                  </div>
                )}

                {removalInProgressId === r.id && (
                  <div className="mb-4 space-y-2">
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all duration-700"
                        style={{ width: `${Math.min((removalStep + 1) * 33, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {removalStep === 0 && 'Sécurisation des preuves...'}
                      {removalStep === 1 && 'Finalisation du dossier de plainte...'}
                      {removalStep === 2 && `Transmission à la plateforme ${sourceLabel}...`}
                    </p>
                  </div>
                )}

                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dossier juridique prêt — une seule action suffit.</p>
                  <button
                    type="button"
                    onClick={() => handleStartRemoval(r)}
                    disabled={removalInProgressId === r.id}
                    className={`inline-flex items-center justify-center min-w-[220px] px-5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      hasShield
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    } disabled:opacity-70`}
                  >
                    {hasShield
                      ? removalInProgressId === r.id
                        ? 'Suppression en cours...'
                        : 'Lancer la suppression automatique'
                      : 'Débloqué avec Pulse / Zenith'}
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

      {showUpgradeModal && (
        <UpgradeModal
          featureKey={FEATURES.SHIELD_HATEFUL}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}

