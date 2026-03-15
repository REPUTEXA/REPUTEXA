'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { BillingToggle } from '@/components/billing/billing-toggle';
import { useBillingCycleOptional } from '@/lib/billing-cycle-context';
import { saveCheckoutIntent } from '@/lib/checkout-intent';
import { calculatePrice, PLAN_BASE_PRICES_EUR, PLAN_BASE_PRICES_USD } from '@/config/pricing';
import type { PlanSlug } from '@/config/pricing';

const PLANS: { slug: PlanSlug; nameKey: string; forKey: string; priceKey: string; features: string[]; pulseStyle?: boolean }[] = [
  { slug: 'vision', nameKey: 'pricing.vision.name', forKey: 'pricing.vision.for', priceKey: 'pricing.vision.price', features: ['pricing.comparison.card_reponses', 'pricing.comparison.card_reporting_vision', 'pricing.comparison.card_ia_tests', 'pricing.comparison.card_langues_vision'] },
  { slug: 'pulse', nameKey: 'pricing.pulse.name', forKey: 'pricing.pulse.for', priceKey: 'pricing.pulse.price', features: ['pricing.comparison.card_reponses', 'pricing.comparison.card_alertes', 'pricing.comparison.card_reporting_pulse', 'pricing.comparison.card_suppression', 'pricing.comparison.card_ia_tests', 'pricing.comparison.card_langues_autres'], pulseStyle: true },
  { slug: 'zenith', nameKey: 'pricing.zenith.name', forKey: 'pricing.zenith.for', priceKey: 'pricing.zenith.price', features: ['pricing.comparison.card_reponses', 'pricing.comparison.card_triple', 'pricing.comparison.card_alertes', 'pricing.comparison.card_reporting_pulse', 'pricing.comparison.card_boost_seo', 'pricing.comparison.card_suppression', 'pricing.comparison.card_ai_capture', 'pricing.comparison.card_consultant', 'pricing.comparison.card_langues_autres'] },
];

export function LandingPricingSection() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const billing = useBillingCycleOptional();
  const isAnnual = billing?.isAnnual ?? false;
  const useUsd = locale === 'en';

  const getBasePrice = (slug: PlanSlug) =>
    (useUsd ? PLAN_BASE_PRICES_USD : PLAN_BASE_PRICES_EUR)[slug] ?? 0;

  const getMonthlyEquivalent = (slug: PlanSlug) => {
    const totalAnnual = calculatePrice(getBasePrice(slug), 1, true);
    return Math.round((totalAnnual / 12) * 100) / 100;
  };
  const getTotalAnnual = (slug: PlanSlug) => calculatePrice(getBasePrice(slug), 1, true);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat(useUsd ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: useUsd ? 'USD' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const suffix = locale === 'en' ? '/month' : '/mois';
  const annualSuffix = locale === 'en' ? 'billed annually' : 'Facturé annuellement';

  return (
    <section id="tarifs" className="py-16 sm:py-20 bg-white dark:bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold text-foreground mb-3">
            {t('pricing.headline')}
          </h2>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
        </div>

        <div className="flex justify-center mb-10">
          <BillingToggle
            annualBadge="-20%"
            monthlyLabel={locale === 'en' ? 'Monthly' : 'Mensuel'}
            annualLabel={locale === 'en' ? 'Annual' : 'Annuel'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan) => {
            const isPulse = plan.pulseStyle;
            const amount = isAnnual ? getMonthlyEquivalent(plan.slug) : calculatePrice(getBasePrice(plan.slug), 1, false);
            const priceDisplay = formatAmount(amount);
            const totalAnnual = isAnnual ? getTotalAnnual(plan.slug) : null;

            return (
              <div
                key={plan.slug}
                className={`flex flex-col h-full rounded-2xl sm:rounded-3xl border p-6 relative transition-all duration-300 ease-in-out hover:-translate-y-1 ${
                  isPulse
                    ? 'gradient-primary text-white border-transparent shadow-glow scale-[1.02] sm:scale-105 hover:shadow-[0_24px_48px_rgba(75,115,255,0.25)]'
                    : 'bg-card border-border shadow-sm hover:shadow-[0_20px_40px_rgba(75,115,255,0.12)]'
                }`}
              >
                {isPulse && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-white text-primary rounded-full">
                    {t('pricing.pulse.badge')}
                  </span>
                )}
                <div className="mb-5">
                  <p className={`font-display font-bold text-lg ${isPulse ? 'text-white' : 'text-foreground'}`}>
                    {t(plan.nameKey)}
                  </p>
                  <p className={`text-xs font-medium mt-0.5 ${isPulse ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {t(plan.forKey)}
                  </p>
                </div>
                <div className="mb-6">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={`${plan.slug}-${isAnnual}-${priceDisplay}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className={`text-4xl font-display font-bold block ${isPulse ? 'text-white' : 'text-foreground'}`}
                    >
                      {priceDisplay}
                      <span className="text-sm font-normal opacity-80 ml-1">{suffix}</span>
                    </motion.span>
                  </AnimatePresence>
                  {isAnnual && totalAnnual != null && (
                    <p className={`text-xs mt-0.5 ${isPulse ? 'text-white/70' : 'text-muted-foreground'}`}>
                      {annualSuffix} · {formatAmount(totalAnnual)}
                    </p>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((key) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 ${isPulse ? 'text-white' : 'text-primary'}`} aria-hidden />
                      <span className={isPulse ? 'text-white/80' : 'text-foreground/80'}>{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <p className={`text-xs font-medium mb-4 ${isPulse ? 'text-emerald-200' : 'text-emerald-600'}`}>{t('pricing.trialMention')}</p>
                <Link
                  href={`/signup?mode=checkout&plan=${plan.slug}&annual=${isAnnual ? '1' : '0'}`}
                  onClick={() => saveCheckoutIntent(plan.slug, isAnnual, 1)}
                  className={`block text-center py-3 min-h-[44px] text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out active:scale-[0.98] ${isPulse ? 'bg-white text-primary hover:bg-white/90' : 'gradient-primary text-white hover:opacity-90'}`}
                >
                  {t('pricing.ctaSubscribe')}
                </Link>
                <Link
                  href="/signup?mode=trial"
                  className={`block text-center py-2 mt-2 text-sm font-medium underline underline-offset-2 hover:no-underline transition-all duration-300 ${isPulse ? 'text-white/90' : 'text-primary'}`}
                >
                  {t('pricing.ctaTrial')}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
