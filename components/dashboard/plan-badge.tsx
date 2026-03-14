'use client';

import { useState } from 'react';
import { Eye, Zap, Crown } from 'lucide-react';
import { type PlanSlug } from '@/lib/feature-gate';
import { PlanUpgradeModal } from './plan-upgrade-modal';

const PLAN_ICONS: Record<PlanSlug, typeof Eye> = {
  free: Eye,
  vision: Eye,
  pulse: Zap,
  zenith: Crown,
};

const PLAN_STYLES: Record<PlanSlug, { bg: string; border: string; icon: string; glow?: string }> = {
  free: {
    bg: 'from-slate-500/15 to-slate-500/5',
    border: 'border-slate-400/40 dark:border-zinc-800/50',
    icon: 'text-slate-400',
  },
  vision: {
    bg: 'from-[#2563eb]/15 to-[#2563eb]/5',
    border: 'border-[#2563eb]/40 dark:border-zinc-800/50',
    icon: 'text-[#2563eb]',
  },
  pulse: {
    bg: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-400/40 dark:border-zinc-800/50',
    icon: 'text-amber-300',
  },
  zenith: {
    bg: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-400/40 dark:border-zinc-800/50',
    icon: 'text-violet-300',
    glow: 'shadow-[0_0_24px_rgba(139,92,246,0.25)] dark:shadow-[0_0_24px_rgba(139,92,246,0.3)]',
  },
};

type Props = {
  planSlug: PlanSlug;
  planDisplayName: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  hasActiveSubscription: boolean;
  locale: string;
};

export function PlanBadge({
  planSlug,
  planDisplayName,
  isTrialing,
  trialDaysLeft,
  hasActiveSubscription,
  locale,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const Icon = PLAN_ICONS[planSlug];
  const styles = PLAN_STYLES[planSlug];

  const label = isTrialing
    ? `Essai ${planDisplayName}${trialDaysLeft != null ? ` — ${trialDaysLeft} jour${trialDaysLeft !== 1 ? 's' : ''} restant${trialDaysLeft !== 1 ? 's' : ''}` : ''}`
    : planDisplayName;

  const isUrgent = isTrialing && trialDaysLeft != null && trialDaysLeft < 3;
  const labelColorClass = isUrgent
    ? trialDaysLeft === 0
      ? 'text-red-300'
      : 'text-amber-300'
    : 'text-white';

  return (
    <>
      <div
        className={`m-3 p-4 rounded-xl bg-gradient-to-br ${styles.bg} border ${styles.border} ${styles.glow ?? ''} flex flex-col gap-2`}
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 ${styles.icon}`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
          </div>
          <span className={`text-xs font-semibold ${labelColorClass}`}>
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full py-2 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/5 dark:hover:bg-white/5 text-white/90 transition-colors"
        >
          {hasActiveSubscription || isTrialing ? 'Changer de plan' : 'Passer au niveau supérieur'}
        </button>
      </div>
      {modalOpen && (
        <PlanUpgradeModal
          currentPlanSlug={planSlug}
          isTrialing={isTrialing}
          hasActiveSubscription={hasActiveSubscription}
          locale={locale}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
