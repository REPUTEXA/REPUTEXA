'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Eye, Zap, Crown, Check, Loader2 } from 'lucide-react';
import { formatPrice } from '@/lib/format-price';
import type { PlanSlug } from '@/lib/feature-gate';

const PLAN_CONFIG: Record<PlanSlug, { icon: typeof Eye; name: string; price: string; features: string[] }> = {
  free: {
    icon: Eye,
    name: 'Gratuit',
    price: '0',
    features: ['Réponses IA langue locale', 'Rapport PDF'],
  },
  vision: {
    icon: Eye,
    name: 'Vision',
    price: '59',
    features: ['Réponses IA langue locale', 'Rapport PDF mensuel'],
  },
  pulse: {
    icon: Zap,
    name: 'Pulse',
    price: '97',
    features: ['Tout Vision', 'Réponses IA toutes langues', 'Alertes WhatsApp', 'Bouclier avis toxiques'],
  },
  zenith: {
    icon: Crown,
    name: 'ZENITH',
    price: '179',
    features: ['Tout Pulse', 'Consultant IA 24/7', 'IA Capture', 'Boost SEO', 'Connecteurs caisse'],
  },
};

const PLAN_ORDER: PlanSlug[] = ['vision', 'pulse', 'zenith'];

type Props = {
  currentPlanSlug: PlanSlug;
  isTrialing: boolean;
  hasActiveSubscription: boolean;
  locale: string;
};

export function UpgradePlansGrid({
  currentPlanSlug,
  isTrialing,
  hasActiveSubscription,
  locale,
}: Props) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);

  const currentLevel = PLAN_ORDER.indexOf(currentPlanSlug);
  const nextPlanIndex = currentLevel < PLAN_ORDER.length - 1 ? currentLevel + 1 : -1;
  const nextPlan = nextPlanIndex >= 0 ? PLAN_ORDER[nextPlanIndex] : null;

  const openPortalForUpgrade = async (targetPlan: PlanSlug) => {
    setLoadingPlan(targetPlan);
    try {
      const url = new URL('/api/stripe/portal', window.location.origin);
      url.searchParams.set('locale', locale);
      url.searchParams.set('flow', 'upgrade');
      const res = await fetch(url.toString(), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL non reçue');
      }
    } catch {
      setLoadingPlan(null);
    }
  };

  const goToCheckout = (targetPlan: PlanSlug) => {
    const skipTrial = isTrialing ? '1' : '0';
    router.push(`/checkout?plan=${targetPlan}${skipTrial === '1' ? '&trial=0' : ''}`);
  };

  const handleSelectPlan = async (slug: PlanSlug) => {
    if (slug === currentPlanSlug) return;
    if (currentPlanSlug === 'zenith') return;

    if (hasActiveSubscription || isTrialing) {
      await openPortalForUpgrade(slug);
    } else {
      goToCheckout(slug);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
      {PLAN_ORDER.map((slug) => {
        const cfg = PLAN_CONFIG[slug];
        const Icon = cfg.icon;
        const isCurrent = slug === currentPlanSlug;
        const isUpgrade = PLAN_ORDER.indexOf(slug) > currentLevel;
        const isNextPlan = slug === nextPlan;
        const isDisabled = slug === currentPlanSlug || currentPlanSlug === 'zenith';

        const cardClass = `
          relative flex flex-col rounded-2xl border p-6 sm:p-8 transition-all duration-300
          ${isNextPlan
            ? 'border-[#2563eb] bg-[#2563eb]/5 dark:bg-[#2563eb]/10 shadow-[0_0_0_1px_rgba(37,99,235,0.2)]'
            : 'border-slate-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]'
          }
          ${!isDisabled && isUpgrade ? 'hover:border-[#2563eb]/60 dark:hover:border-[#2563eb]/60 hover:shadow-lg' : ''}
          ${isDisabled ? 'opacity-80' : ''}
        `;

        return (
          <div
            key={slug}
            className={cardClass}
          >
            {isNextPlan && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#2563eb] text-white">
                Recommandé
              </span>
            )}
            <div className="flex items-center gap-3 mb-4">
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
              <div>
                <p className="font-display font-bold text-lg text-slate-900 dark:text-zinc-100">
                  {cfg.name}
                </p>
                <p className="text-xl font-semibold text-slate-700 dark:text-zinc-300">
                  {formatPrice(locale, cfg.price)}
                </p>
              </div>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {cfg.features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400"
                >
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => handleSelectPlan(slug)}
              className={`
                w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                flex items-center justify-center gap-2
                ${isDisabled
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-500 cursor-default'
                  : isNextPlan
                    ? 'bg-[#2563eb] text-white hover:brightness-110 active:scale-[0.98]'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98]'
                }
              `}
            >
              {loadingPlan === slug ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirection...
                </>
              ) : isCurrent ? (
                'Plan actuel'
              ) : isUpgrade ? (
                hasActiveSubscription || isTrialing ? 'Changer de plan' : 'S\'abonner'
              ) : (
                'S\'abonner'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
