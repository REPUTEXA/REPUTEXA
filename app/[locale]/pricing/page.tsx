'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/logo';
import { LanguageSelector } from '@/components/language-selector';
import { CurrencySelector } from '@/components/currency-selector';
import { BillingToggle } from '@/components/billing/billing-toggle';
import { useBillingCycle } from '@/lib/billing-cycle-context';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { saveCheckoutIntent, getCheckoutIntent } from '@/lib/checkout-intent';
import {
  calculatePrice,
  calculateSavings,
  calculateAnnualSavings,
  getPlanBasePricesForBillingCurrency,
  type PlanSlug,
} from '@/config/pricing';
import { useOptionalBillingCurrency } from '@/components/billing-currency-provider';
import { PLAN_DISPLAY_CONFIG, PLAN_ORDER } from '@/config/pricing-plan-display';
import { PricingCompareModal } from '@/components/pricing/pricing-compare-modal';
import {
  isStripeValidationErrorCode,
  stripeValidationErrorToApiStripeKey,
} from '@/lib/validations/stripe-api-error';
import { useFormatPricingMoney } from '@/lib/i18n/use-pricing-money-format';
import { HoverTooltip } from '@/components/ui/hover-tooltip';

const PLAN_TO_STRIPE: Record<string, 'starter' | 'manager' | 'dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'dominator',
};

/** Prix et checkout : un siège par abonnement. */
const CHECKOUT_QUANTITY = 1;

const TRIAL_SIGNUP_HREF = '/signup?mode=trial';

const ZENITH_CARD_BORDER =
  'border border-[#2563eb]/80 dark:border-[#3b82f6]/50 shadow-md shadow-slate-200/40 dark:shadow-black/20 ring-1 ring-[#2563eb]/15';
const DEFAULT_PLAN_CARD_BORDER = 'border border-slate-200/90 dark:border-slate-800 shadow-sm';
const ZENITH_PRICE_CLASS = 'text-[#2563eb]';
const DEFAULT_PRICE_CLASS = 'text-slate-900 dark:text-slate-100';

const REF_PLAN_FOR_TOTAL_SAVINGS: PlanSlug = 'pulse';

export default function PricingPage() {
  const t = useTranslations('PricingPage');
  const tStripeErr = useTranslations('ApiStripe.errors');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAnnual: annual, setBillingCycle } = useBillingCycle();
  const cancelledHandledRef = useRef(false);
  const resumeHandledRef = useRef(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [acceptedCgu, setAcceptedCgu] = useState(false);
  const [acceptedZenith, setAcceptedZenith] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const { billingCurrency } = useOptionalBillingCurrency();
  const planBasePrices = getPlanBasePricesForBillingCurrency(billingCurrency);
  const currencyFmt = useFormatPricingMoney();

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
      const data = getCheckoutIntent();
      if (!data) return;
      resumeHandledRef.current = true;
      if (data.annual === true) setBillingCycle('year');
      else if (data.annual === false) setBillingCycle('month');
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
    } catch (error) {
      console.error('[pricing] resume checkout intent', error);
    }
  }, [statusCancelled, setBillingCycle, t]);

  const getBasePrice = (planKey: string) => planBasePrices[planKey as PlanSlug] ?? 0;

  const formatPrice = (planKey: string) => {
    const amount = calculatePrice(getBasePrice(planKey), CHECKOUT_QUANTITY, annual);
    return currencyFmt(amount);
  };

  /** Pour l'affichage annuel : prix mensuel équivalent (total annuel / 12) et total annuel pour "Facturé annuellement". */
  const getAnnualDisplay = (planKey: string) => {
    const totalAnnual = calculatePrice(getBasePrice(planKey), CHECKOUT_QUANTITY, true);
    return { monthlyEquivalent: totalAnnual / 12, totalAnnual };
  };

  const suffix = annual ? t('perYear') : t('perMonth');

  const sortedPlans = [...PLAN_DISPLAY_CONFIG].sort(
    (a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug)
  );

  const basePulseForSavings = getBasePrice(REF_PLAN_FOR_TOTAL_SAVINGS);
  const totalSavingsBadgeAmount =
    calculateSavings(basePulseForSavings, CHECKOUT_QUANTITY) +
    (annual ? calculateAnnualSavings(basePulseForSavings, CHECKOUT_QUANTITY) : 0);

  const handleSubscribe = (planKey: string) => {
    saveCheckoutIntent(planKey, annual, CHECKOUT_QUANTITY);
    if (!session) {
      router.push(
        `/${locale}/signup?mode=checkout&plan=${planKey}&annual=${annual ? '1' : '0'}&quantity=${CHECKOUT_QUANTITY}`
      );
      return;
    }
    handleCheckout(planKey);
  };

  const handleCheckout = async (planKey: string) => {
    if (!session) return;
    saveCheckoutIntent(planKey, annual, CHECKOUT_QUANTITY);
    setCheckoutLoading(planKey);
    const qty = CHECKOUT_QUANTITY;
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
      if (!res.ok) {
        const msg = isStripeValidationErrorCode(data.error)
          ? tStripeErr(stripeValidationErrorToApiStripeKey(data.error))
          : typeof data.error === 'string' && data.error.trim()
            ? data.error
            : tStripeErr('generic');
        throw new Error(msg);
      }
      if (data.url) window.location.href = data.url;
      else throw new Error(t('checkoutError'));
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
      <header className="border-b border-black/[0.06] dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href={logoHref}
            className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100"
            aria-label={t('brandAria')}
          >
            <Logo />
            <span className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-50">{t('brandName')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSelector variant="light" hintScope="site" />
            <CurrencySelector variant="light" />
            {backLinkVisible && (
              <Link
                href="/dashboard"
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium whitespace-nowrap"
              >
                {t('backToDashboard')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h1 className="text-[1.75rem] sm:text-[2.125rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            {t('headline')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-[15px] leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Toggle Monthly / Annual — catalogue synchronisé avec le cycle */}
        <div className="flex justify-center mb-12">
          <HoverTooltip label={t('tooltipBillingCycle')} side="top">
            <div className="inline-flex rounded-2xl outline-none" role="presentation">
              <BillingToggle
                annualBadge={t('annualBadge')}
                monthlyLabel={t('monthly')}
                annualLabel={t('annual')}
              />
            </div>
          </HoverTooltip>
        </div>

        {/* Badge Économisez (annuel et/ou quantité) */}
        <SavingsBadge totalSavings={totalSavingsBadgeAmount} currencyFmt={currencyFmt} t={t} />

        {/* Cartes triées par PLAN_ORDER : Vision, Pulse, Zenith (Mensuel ou Annuel). */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-plan-order={PLAN_ORDER.join(',')}>
          {sortedPlans.map((plan) => {
            const slug = plan.slug;
            const isZenith = plan.primary;
            const { monthlyEquivalent, totalAnnual } = getAnnualDisplay(slug);
            const cardBorder = isZenith ? ZENITH_CARD_BORDER : DEFAULT_PLAN_CARD_BORDER;
            const priceClass = isZenith ? ZENITH_PRICE_CLASS : DEFAULT_PRICE_CLASS;

            return (
              <div
                key={slug}
                id={`plan-card-${slug}`}
                className={`rounded-2xl bg-white dark:bg-slate-900 ${cardBorder} p-6 flex flex-col relative`}
              >
                {plan.badgeKey && (
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                    <HoverTooltip
                      label={slug === 'zenith' ? t('tooltipBadgeZenith') : t('tooltipBadgePulse')}
                      side="bottom"
                    >
                      <span
                        className={`block cursor-help px-3 py-1 rounded-full text-white text-xs font-bold ${isZenith ? 'bg-[#2563eb]' : 'bg-slate-600 dark:bg-slate-500'}`}
                      >
                        {t(plan.badgeKey)}
                      </span>
                    </HoverTooltip>
                  </div>
                )}
                <h2 className={`font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100 ${plan.badgeKey ? 'mt-1' : ''}`}>
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
                          key={`annual-${slug}`}
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
                      {(() => {
                        const planSavings = calculateAnnualSavings(getBasePrice(slug), CHECKOUT_QUANTITY);
                        if (planSavings <= 0) return null;
                        return (
                          <p
                            className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-green-600 dark:text-green-400"
                            role="status"
                          >
                            <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                            {t('savingsPerYear', { amount: currencyFmt(planSavings) })}
                          </p>
                        );
                      })()}
                    </>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`monthly-${slug}`}
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
                <ul className="mt-6 space-y-3 flex-1">
                  {plan.featureKeys.map((key) => (
                    <li key={key} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      {t(key)}
                    </li>
                  ))}
                </ul>

                {slug === 'zenith' && (
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        id="checkbox-zenith-rgpd"
                        type="checkbox"
                        checked={acceptedZenith}
                        onChange={(e) => setAcceptedZenith(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 accent-[#2563eb] cursor-pointer"
                      />
                      <span className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300 transition-colors">
                        {t('zenithDataConsent')}
                      </span>
                    </label>
                  </div>
                )}
                <PlanButton
                  planKey={slug}
                  loading={checkoutLoading === slug}
                  sessionLoading={sessionLoading}
                  onSubscribe={() => handleSubscribe(slug)}
                  trialHref={TRIAL_SIGNUP_HREF}
                  t={t}
                  primary={plan.primary}
                  legalBlocked={!acceptedCgu || (slug === 'zenith' && !acceptedZenith)}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-center mt-10 mb-2 px-4">
          <HoverTooltip label={t('tooltipCompareAll')} side="top">
            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#2563eb] bg-white dark:bg-slate-900 px-5 py-3 text-sm sm:text-[15px] font-semibold text-[#2563eb] dark:text-blue-400 shadow-sm hover:bg-[#2563eb]/[0.06] dark:hover:bg-[#2563eb]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 transition-colors"
            >
              {t('compareOpenButton')}
            </button>
          </HoverTooltip>
        </div>

        <PricingCompareModal open={compareModalOpen} onClose={() => setCompareModalOpen(false)} />

        {/* Validation légale — obligatoire avant tout paiement Stripe */}
        <div className="mt-10 max-w-xl mx-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 ring-1 ring-black/[0.03] dark:ring-white/[0.04] shadow-sm px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
              <ShieldCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                {t('legalSectionTitle')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
                {t('legalSectionSubtitle')}
              </p>
            </div>
          </div>

          {/* Checkbox 1 — tous les plans */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              id="checkbox-cgu"
              type="checkbox"
              checked={acceptedCgu}
              onChange={(e) => setAcceptedCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-slate-600 accent-[#2563eb] cursor-pointer"
            />
            <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
              {t.rich('legalAcceptCheckbox', {
                terms: (chunks) => (
                  <Link
                    href="/legal/cgu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-[#2563eb] hover:text-[#1d4ed8] transition-colors"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href="/legal/confidentialite"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-[#2563eb] hover:text-[#1d4ed8] transition-colors"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>

          {!acceptedCgu && (
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 flex items-center gap-2 pl-1">
              <span className="w-1 h-8 rounded-full bg-amber-400/80 dark:bg-amber-500/50 shrink-0" aria-hidden />
              {t('legalCheckHint')}
            </p>
          )}
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

function SavingsBadge({
  totalSavings,
  currencyFmt,
  t,
}: {
  totalSavings: number;
  currencyFmt: (amount: number) => string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  if (totalSavings <= 0) return null;
  return (
    <div className="flex justify-center mb-8">
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
        {t('savingsBadge', { amount: currencyFmt(totalSavings) })}
      </span>
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
  legalBlocked = false,
}: {
  planKey: string;
  loading: boolean;
  sessionLoading: boolean;
  onSubscribe: () => void;
  trialHref: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  primary?: boolean;
  legalBlocked?: boolean;
}) {
  const isDisabled = sessionLoading || loading || legalBlocked;
  const baseClass = 'mt-6 block w-full py-3 rounded-xl text-center font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  const primaryClass = 'bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:hover:bg-[#2563eb]';
  const secondaryClass = 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 disabled:hover:bg-slate-800 dark:disabled:hover:bg-slate-100';

  return (
    <div className="space-y-2" data-plan={planKey}>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={isDisabled}
        aria-describedby={legalBlocked ? `legal-hint-${planKey}` : undefined}
        className={`${baseClass} ${primary ? primaryClass : secondaryClass}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : null}
        {t('ctaSubscribe')}
      </button>
      {legalBlocked && (
        <p
          id={`legal-hint-${planKey}`}
          className="text-center text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed"
        >
          {planKey === 'zenith' ? t('planBlockedZenith') : t('planBlockedDefault')}
        </p>
      )}
      <Link
        href={trialHref}
        className="block w-full py-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] underline underline-offset-2 hover:no-underline transition-colors"
      >
        {t('ctaTrial')}
      </Link>
    </div>
  );
}
// Build trigger: 2026-03-20
