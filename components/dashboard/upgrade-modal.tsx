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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
          </div>
          <h2 id="upgrade-modal-title" className="font-display text-lg font-bold text-slate-900">
            Fonctionnalité réservée
          </h2>
        </div>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Cette fonctionnalité est réservée aux membres <strong className="text-slate-900">{planName}</strong>.
          Voulez-vous booster votre visibilité ?
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Passer au plan {planName}
          </button>
        </div>
      </div>
    </div>
  );
}
