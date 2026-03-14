'use client';

import { useRouter } from '@/i18n/navigation';
import { Lock } from 'lucide-react';
import { getRequiredPlanDisplayName, getRequiredPlanForFeature, type FeatureKey } from '@/lib/feature-gate';

type Props = {
  featureKey: FeatureKey;
  onClose: () => void;
};

export function UpgradeModal({ featureKey, onClose }: Props) {
  const router = useRouter();
  const planName = getRequiredPlanDisplayName(featureKey);

  const handleUpgrade = () => {
    onClose();
    router.push(`/checkout?plan=${getRequiredPlanForFeature(featureKey)}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 dark:bg-black/80 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="bg-white dark:bg-[#0c0c0e] dark:backdrop-blur-xl rounded-t-2xl md:rounded-2xl shadow-xl dark:shadow-2xl max-w-md w-full p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] border border-slate-200 dark:border-zinc-800/50 animate-bottom-sheet-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
          </div>
          <h2 id="upgrade-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-zinc-100">
            Fonctionnalité réservée
          </h2>
        </div>
        <p className="text-slate-600 dark:text-zinc-400 text-sm leading-relaxed mb-6">
          Cette fonctionnalité est réservée aux membres <strong className="text-slate-900 dark:text-zinc-100">{planName}</strong>.
          Voulez-vous booster votre visibilité ?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 rounded-2xl border border-slate-200 dark:border-zinc-800/50 text-slate-600 dark:text-zinc-100 font-medium hover:bg-slate-50 dark:hover:bg-white/5 active:scale-[0.98] transition-transform"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex-1 min-h-[44px] py-2.5 rounded-2xl bg-primary dark:bg-indigo-600 text-white font-semibold hover:brightness-110 dark:hover:bg-indigo-500 active:scale-[0.98] transition-transform"
          >
            Passer au plan {planName}
          </button>
        </div>
      </div>
    </div>
  );
}
