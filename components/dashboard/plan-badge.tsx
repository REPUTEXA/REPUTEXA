'use client';

import { useState } from 'react';
import { Eye, Zap, Crown, Loader2, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type PlanSlug } from '@/lib/feature-gate';
import { toast } from 'sonner';

/** Nom d'affichage du plan pour la ligne "Passage sur X programmé" */
const FUTURE_PLAN_DISPLAY: Record<string, string> = {
  vision: 'VISION',
  pulse: 'PULSE',
  zenith: 'ZENITH',
};

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
  selectedPlanFromProfile?: string | null;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  hasActiveSubscription: boolean;
  locale: string;
};

/** Ouvre le Portail Client Stripe (écran « Mettre à jour l'abonnement »). Zéro interface de sélection en interne. */
async function openStripePortal(locale: string, fallbackError: string): Promise<string | null> {
  const url = new URL('/api/stripe/portal', window.location.origin);
  url.searchParams.set('locale', locale);
  url.searchParams.set('flow', 'upgrade');
  const res = await fetch(url.toString(), { method: 'POST', credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? fallbackError);
  return data.url ?? null;
}

export function PlanBadge({
  planSlug,
  planDisplayName,
  selectedPlanFromProfile = null,
  isTrialing,
  trialDaysLeft,
  hasActiveSubscription,
  locale,
}: Props) {
  const t = useTranslations('Dashboard.planBadge');
  const [loading, setLoading] = useState(false);
  const Icon = PLAN_ICONS[planSlug];
  const styles = PLAN_STYLES[planSlug];

  const futurePlanName = selectedPlanFromProfile
    ? FUTURE_PLAN_DISPLAY[selectedPlanFromProfile.toLowerCase()] ?? selectedPlanFromProfile.toUpperCase()
    : null;
  const showFuturePlanLine = isTrialing && !!futurePlanName;

  const label = isTrialing
    ? trialDaysLeft != null
      ? t('trialWithDays', { planName: planDisplayName, days: trialDaysLeft })
      : t('trialSimple', { planName: planDisplayName })
    : planDisplayName;

  const isUrgent = isTrialing && trialDaysLeft != null && trialDaysLeft < 3;
  const labelColorClass = isUrgent
    ? trialDaysLeft === 0
      ? 'text-red-300'
      : 'text-amber-300'
    : 'text-white';

  const handleClick = async () => {
    setLoading(true);
    try {
      const portalUrl = await openStripePortal(locale, t('toastPortalOpenFailed'));
      if (portalUrl) window.location.href = portalUrl;
      else toast.error(t('toastPortalOpenFailed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastGenericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`m-3 p-4 rounded-xl bg-gradient-to-br ${styles.bg} border ${styles.border} ${styles.glow ?? ''} flex flex-col gap-2 min-w-0`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-white/10 ${styles.icon}`}>
          <Icon className="h-4 w-4 flex-shrink-0" />
        </div>
        <span className={`text-xs font-semibold min-w-0 flex-1 break-words ${labelColorClass}`}>
          {label}
        </span>
      </div>
      {showFuturePlanLine && (
        <p className="text-xs opacity-80 text-white/80 flex items-start gap-1.5 mt-0.5 min-w-0">
          <Calendar className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden />
          <span className="min-w-0 break-words">
            {t('futureScheduled', { plan: futurePlanName ?? '' })}
          </span>
        </p>
      )}
      {!isTrialing && (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="w-full min-w-0 py-2 px-2 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/5 dark:hover:bg-white/5 text-white/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 text-center"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : null}
          <span className="break-words">
            {hasActiveSubscription ? t('ctaChangePlan') : t('ctaUpgrade')}
          </span>
        </button>
      )}
    </div>
  );
}
