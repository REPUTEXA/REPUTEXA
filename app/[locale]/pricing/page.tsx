'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/logo';
import { BillingToggle } from '@/components/billing/billing-toggle';
import { useBillingCycle } from '@/lib/billing-cycle-context';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveCheckoutIntent, getCheckoutIntent } from '@/lib/checkout-intent';
import {
  calculatePrice,
  calculateSavings,
  calculateAnnualSavings,
  PLAN_BASE_PRICES_EUR,
  PLAN_BASE_PRICES_USD,
  type PlanSlug,
} from '@/config/pricing';

const PLAN_TO_STRIPE: Record<string, 'starter' | 'manager' | 'dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'dominator',
};

/** Ordre d'affichage constant : Vision, Pulse, Zenith (Mensuel ou Annuel). */
const PLAN_ORDER: PlanSlug[] = ['vision', 'pulse', 'zenith'];

type PlanConfig = {
  slug: PlanSlug;
  titleKey: string;
  descKey: string;
  featureKeys: string[];
  badgeKey: string | null;
  primary: boolean;
};

const PLAN_CONFIG: PlanConfig[] = [
  { slug: 'vision', titleKey: 'visionTitle', descKey: 'visionDesc', featureKeys: ['visionFeature1', 'visionFeature2'], badgeKey: null, primary: false },
  { slug: 'pulse', titleKey: 'pulseTitle', descKey: 'pulseDesc', featureKeys: ['pulseFeature1', 'pulseFeature2', 'pulseFeature3'], badgeKey: 'pulseBadge', primary: false },
  { slug: 'zenith', titleKey: 'zenithTitle', descKey: 'zenithDesc', featureKeys: ['zenithFeature1', 'zenithFeature2', 'zenithFeature3'], badgeKey: 'zenithBadge', primary: true },
];

export default function PricingPage() {
  const t = useTranslations('PricingPage');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAnnual: annual, setBillingCycle } = useBillingCycle();
  const [quantity, setQuantity] = useState(1);
  const cancelledHandledRef = useRef(false);
  const resumeHandledRef = useRef(false);
  const setQuantityClamped = (value: number | ((prev: number) => number)) => {
    setQuantity((prev) => {
      const v = typeof value === 'function' ? value(prev) : value;
      return Math.min(15, Math.max(1, Math.round(Number(v)) || 1));
    });
  };
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const useUsd = locale === 'en';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Retour annulation Stripe : toast élégant + forcer toggle depuis URL + scroll vers le plan
  const statusCancelled = searchParams?.get('status') === 'cancelled';
  const urlPlan = searchParams?.get('plan');
  const urlAnnual = searchParams?.get('annual');
  useEffect(() => {
    if (!statusCancelled || cancelledHandledRef.current) return;
    cancelledHandledRef.current = true;
    toast.info(t('paymentCancelledToast'), {
      duration: 5000,
      className: 'border-slate-200 dark:border-slate-700 shadow-lg',
    });
    if (urlAnnual === '1') setBillingCycle('year');
    else if (urlAnnual === '0') setBillingCycle('month');
    const plan = urlPlan && ['vision', 'pulse', 'zenith'].includes(urlPlan) ? urlPlan : null;
    if (plan) {
      const id = `plan-card-${plan}`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    }
    // Retirer status=cancelled de l'URL pour que un refresh ne réaffiche pas le toast
    const url = new URL(window.location.href);
    url.searchParams.delete('status');
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [statusCancelled, urlPlan, urlAnnual, setBillingCycle, t]);

  // Fallback localStorage : utilisateur revient plus tard sans passer par cancel_url
  useEffect(() => {
    if (statusCancelled || resumeHandledRef.current) return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CHECKOUT_INTENT_KEY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { plan?: string; annual?: boolean; quantity?: number; timestamp?: number };
      if (!data?.plan || !data.timestamp || Date.now() - data.timestamp > INTENT_MAX_AGE_MS) return;
      resumeHandledRef.current = true;
      if (data.annual === true) setBillingCycle('year');
      else if (data.annual === false) setBillingCycle('month');
      if (typeof data.quantity === 'number' && data.quantity >= 1 && data.quantity <= 15) {
      setQuantityClamped(data.quantity);
    }
    const plan = ['vision', 'pulse', 'zenith'].includes(data.plan) ? data.plan : null;
    if (plan) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(`plan-card-${plan}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      toast.info(t('resumeCheckoutToast'), {
        duration: 6000,
        className: 'border-slate-200 dark:border-slate-700 shadow-lg',
      });
    }
  }, [statusCancelled, setBillingCycle, t]);

  const getBasePrice = (planKey: string) =>
    (useUsd ? PLAN_BASE_PRICES_USD : PLAN_BASE_PRICES_EUR)[planKey as PlanSlug] ?? 0;
  const getSavingsAmount = (planKey: string) =>
    calculateSavings(getBasePrice(planKey), quantity);
  const getAnnualSavingsAmount = (planKey: string) =>
    calculateAnnualSavings(getBasePrice(planKey), quantity);

  const currencyFmt = (amount: number) =>
    new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: useUsd ? 'USD' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPrice = (planKey: string) => {
    const amount = calculatePrice(getBasePrice(planKey), quantity, annual);
    return currencyFmt(amount);
  };

  /** Pour l'affichage annuel : prix mensuel équivalent (total annuel / 12) et total annuel pour "Facturé annuellement". */
  const getAnnualDisplay = (planKey: string) => {
    const totalAnnual = calculatePrice(getBasePrice(planKey), quantity, true);
    return { monthlyEquivalent: totalAnnual / 12, totalAnnual };
  };

  const suffix = annual ? t('perYear') : t('perMonth');

  const sortedPlans = [...PLAN_CONFIG].sort(
    (a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug)
  );

  const handleSubscribe = (planKey: string) => {
    saveCheckoutIntent(planKey, annual, quantity);
    if (!session) {
      router.push(`/${locale}/signup?mode=checkout&plan=${planKey}&annual=${annual ? '1' : '0'}`);
      return;
    }
    handleCheckout(planKey);
  };

  const handleCheckout = async (planKey: string) => {
    if (!session) return;
    saveCheckoutIntent(planKey, annual, quantity);
    setCheckoutLoading(planKey);
    const qty = Math.min(15, Math.max(1, quantity));
    try {
      const params = new URLSearchParams({
        locale,
        planType: PLAN_TO_STRIPE[planKey] ?? 'manager',
        planSlug: planKey,
      });
      if (annual) params.set('annual', '1');
      params.set('quantity', String(qty));
      if (annual) params.set('skipTrial', '1');
      const res = await fetch(`/api/stripe/create-checkout?${params}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data.url) window.location.href = data.url;
      else throw new Error('URL de paiement non reçue');
    } catch (err) {
      console.error('[pricing] checkout:', err);
      toast.error(err instanceof Error ? err.message : t('checkoutError'));
      setCheckoutLoading(null);
    }
  };

  const logoHref = session ? '/dashboard' : '/';
  const backLinkVisible = session;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href={logoHref}
            className="flex items-center gap-2 text-slate-800 dark:text-slate-100"
            aria-label="REPUTEXA"
          >
            <Logo />
            <span className="font-display font-bold text-lg uppercase">REPUTEXA</span>
          </Link>
          {backLinkVisible && (
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
            >
              {t('backToDashboard')}
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
            {t('headline')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {t('subtitle')}
          </p>
        </div>

        {/* Toggle Monthly / Annual — catalogue synchronisé avec le cycle */}
        <div className="flex justify-center mb-12">
          <BillingToggle
            annualBadge={t('annualBadge')}
            monthlyLabel={t('monthly')}
            annualLabel={t('annual')}
          />
        </div>

        {/* Badge Économisez (annuel et/ou quantité) */}
        {(() => {
          const basePulse = getBasePrice('pulse');
          const savingsDegressive = calculateSavings(basePulse, quantity);
          const savingsAnnual = annual ? calculateAnnualSavings(basePulse, quantity) : 0;
          const totalSavings = savingsDegressive + savingsAnnual;
          if (totalSavings <= 0) return null;
          return (
            <div className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                {t('savingsBadge', {
                  amount: new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
                    style: 'currency',
                    currency: useUsd ? 'USD' : 'EUR',
                    maximumFractionDigits: 0,
                  }).format(totalSavings),
                })}
              </span>
            </div>
          );
        })()}

        {/* Slider quantité établissements — prix mis à jour dynamiquement */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 max-w-md mx-auto">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('establishments')}
            </span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setQuantityClamped((q) => q - 1)}
              disabled={quantity <= 1}
              className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              −
            </button>
            <input
              type="range"
              min={1}
              max={15}
              value={Math.min(15, Math.max(1, quantity))}
              onChange={(e) => setQuantityClamped(Number(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-[#2563eb] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setQuantityClamped((q) => q + 1)}
              disabled={quantity >= 15}
              className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              +
            </button>
            <span className="min-w-[2rem] text-center font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {quantity}
            </span>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-10 max-w-md mx-auto">
          {t('prorataMessage')}
        </p>

        {/* Cartes triées par PLAN_ORDER : Vision, Pulse, Zenith (Mensuel ou Annuel). */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-plan-order={PLAN_ORDER.join(',')}>
          {sortedPlans.map((plan) => {
            const slug = plan.slug;
            const isZenith = plan.primary;
            const { monthlyEquivalent, totalAnnual } = getAnnualDisplay(slug);
            const cardBorder = isZenith
              ? 'border-2 border-[#2563eb] shadow-lg shadow-[#2563eb]/15 ring-2 ring-[#2563eb]/20'
              : 'border border-slate-200 dark:border-slate-800 shadow-sm';
            const priceClass = isZenith ? 'text-[#2563eb]' : 'text-slate-900 dark:text-slate-100';

            return (
              <div
                key={slug}
                id={`plan-card-${slug}`}
                className={`rounded-2xl bg-white dark:bg-slate-900 ${cardBorder} p-6 flex flex-col relative`}
              >
                {plan.badgeKey && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-xs font-bold ${isZenith ? 'bg-[#2563eb]' : 'bg-slate-600 dark:bg-slate-500'}`}
                  >
                    {t(plan.badgeKey)}
                  </span>
                )}
                <h2 className={`font-display font-bold text-xl text-slate-900 dark:text-slate-100 ${plan.badgeKey ? 'mt-1' : ''}`}>
                  {t(plan.titleKey)}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t(plan.descKey)}
                </p>
                <div className="mt-4">
                  {annual ? (
                    <>
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={`annual-${slug}-${quantity}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className={`text-2xl font-bold ${priceClass}`}
                        >
                          {currencyFmt(monthlyEquivalent)}
                          <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{t('perMonth')}</span>
                        </motion.p>
                      </AnimatePresence>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {t('billedAnnually', { amount: currencyFmt(totalAnnual) })}
                      </p>
                    </>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`monthly-${slug}-${quantity}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className={`text-2xl font-bold ${priceClass}`}
                      >
                        {formatPrice(slug)}
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{suffix}</span>
                      </motion.p>
                    </AnimatePresence>
                  )}
                </div>
                {quantity > 1 && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {t('perEstablishments', { count: quantity })}
                    {getSavingsAmount(slug) > 0 && (
                      <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                        · {t('savings', { amount: currencyFmt(getSavingsAmount(slug)) })}
                      </span>
                    )}
                  </p>
                )}
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <PlanButton
                  planKey={slug}
                  loading={checkoutLoading === slug}
                  sessionLoading={sessionLoading}
                  onSubscribe={() => handleSubscribe(slug)}
                  trialHref="/signup?mode=trial"
                  t={t}
                  primary={plan.primary}
                />
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          {t('stripeReassurance')}
        </p>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
          {t('trialMention')}
        </p>
      </main>
    </div>
  );
}

function PlanButton({
  planKey,
  loading,
  sessionLoading,
  onSubscribe,
  trialHref,
  t,
  primary,
}: {
  planKey: string;
  loading: boolean;
  sessionLoading: boolean;
  onSubscribe: () => void;
  trialHref: string;
  t: (k: string) => string;
  primary?: boolean;
}) {
  const baseClass = 'mt-6 block w-full py-3 rounded-xl text-center font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2';
  const primaryClass = 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]';
  const secondaryClass = 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200';

  return (
    <div className="space-y-2" data-plan={planKey}>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={sessionLoading || loading}
        className={`${baseClass} ${primary ? primaryClass : secondaryClass}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : null}
        {t('ctaSubscribe')}
      </button>
      <Link
        href={trialHref}
        className="block w-full py-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] underline underline-offset-2 hover:no-underline transition-colors"
      >
        {t('ctaTrial')}
      </Link>
    </div>
  );
}
