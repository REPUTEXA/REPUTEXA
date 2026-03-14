'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from '@/i18n/navigation';
import { X, Eye, Zap, Crown, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/format-price';
import { type PlanSlug } from '@/lib/feature-gate';

const PLAN_CONFIG: Record<PlanSlug, { icon: typeof Eye; name: string; price: string }> = {
  free: { icon: Eye, name: 'Gratuit', price: '0' },
  vision: { icon: Eye, name: 'Vision', price: '59' },
  pulse: { icon: Zap, name: 'Pulse', price: '98' },
  zenith: { icon: Crown, name: 'ZENITH', price: '179' },
};

type Props = {
  currentPlanSlug: PlanSlug;
  isTrialing: boolean;
  hasActiveSubscription: boolean;
  locale: string;
  onClose: () => void;
};

export function PlanUpgradeModal({
  currentPlanSlug,
  isTrialing,
  hasActiveSubscription,
  locale,
  onClose,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState<PlanSlug | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const planOrder: PlanSlug[] = ['free', 'vision', 'pulse', 'zenith'];
  const currentLevel = planOrder.indexOf(currentPlanSlug);
  const upgradeablePlans = planOrder.filter((_, i) => i > currentLevel);

  const handleSelectPlan = async (targetPlan: PlanSlug) => {
    setLoading(targetPlan);
    setError(null);
    try {
      if (hasActiveSubscription) {
        const res = await fetch('/api/stripe/upgrade-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planSlug: targetPlan }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.needsCheckout && data.url) {
            window.location.href = data.url;
            return;
          }
          throw new Error(data.error ?? 'Erreur');
        }
        if (data.needsCheckout && data.url) {
          window.location.href = data.url;
          return;
        }
        onClose();
        router.refresh();
        window.location.reload();
      } else {
        const skipTrial = isTrialing ? '1' : '0';
        const url = `/${locale}/checkout?plan=${targetPlan}${skipTrial === '1' ? '&trial=0' : ''}`;
        router.push(url);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(null);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-upgrade-modal-title"
    >
      <div
        className="bg-white dark:bg-[#0c0c0e] dark:backdrop-blur-xl rounded-2xl shadow-xl dark:shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200 dark:border-zinc-800/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="plan-upgrade-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-zinc-100">
            Changer de plan
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/5"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          {hasActiveSubscription
            ? 'Passage au prorata : vous payez uniquement la différence pour les jours restants du mois.'
            : isTrialing
              ? "Transformez votre essai en abonnement pour conserver l'accès."
              : 'Choisissez votre plan pour débloquer de nouvelles fonctionnalités.'}
        </p>

        <div className="space-y-3">
          {(upgradeablePlans.length > 0 ? upgradeablePlans : planOrder).map((slug) => {
            const cfg = PLAN_CONFIG[slug];
            const Icon = cfg.icon;
            const isCurrent = slug === currentPlanSlug;
            const isUpgrade = planOrder.indexOf(slug) > currentLevel;

            return (
              <button
                key={slug}
                type="button"
                disabled={isCurrent || !!loading}
                onClick={() => isUpgrade && handleSelectPlan(slug)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  isCurrent
                    ? 'border-slate-200 dark:border-zinc-800/50 bg-slate-50 dark:bg-zinc-900/50 opacity-70 cursor-default'
                    : isUpgrade
                      ? 'border-[#2563eb]/50 bg-[#2563eb]/5 dark:border-zinc-700 dark:bg-zinc-900/80 hover:border-[#2563eb] hover:bg-[#2563eb]/10 dark:hover:bg-white/5 cursor-pointer'
                      : 'border-slate-200 dark:border-zinc-800/50 opacity-60 cursor-default'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    slug === 'vision'
                      ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                      : slug === 'pulse'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-zinc-100">{cfg.name}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    {formatPrice(locale, cfg.price)}
                  </p>
                </div>
                {isUpgrade && (
                  <span className="text-xs font-semibold text-primary shrink-0">
                    {loading === slug ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Choisir'
                    )}
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 shrink-0">Actuel</span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-zinc-500 text-center">
          {hasActiveSubscription && 'Le prorata est calculé automatiquement. Activation immédiate.'}
        </p>
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
