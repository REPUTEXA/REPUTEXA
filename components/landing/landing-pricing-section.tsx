'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Table2 } from 'lucide-react';
import { PricingCompareModal } from '@/components/pricing/pricing-compare-modal';
import { BillingToggle } from '@/components/billing/billing-toggle';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { useBillingCycleOptional } from '@/lib/billing-cycle-context';
import { saveCheckoutIntent } from '@/lib/checkout-intent';
import {
  calculatePrice,
  calculateAnnualSavings,
  getPlanBasePricesForBillingCurrency,
} from '@/config/pricing';
import type { PlanSlug } from '@/config/pricing';
import { useOptionalBillingCurrency } from '@/components/billing-currency-provider';
import { useFormatPricingMoney } from '@/lib/i18n/use-pricing-money-format';

const PLANS: { slug: PlanSlug; nameKey: string; forKey: string; priceKey: string; features: string[]; pulseStyle?: boolean }[] = [
  {
    slug: 'vision',
    nameKey: 'pricing.vision.name',
    forKey: 'pricing.vision.for',
    priceKey: 'pricing.vision.price',
    features: [
      'pricing.comparison.landing_vision_1',
      'pricing.comparison.landing_vision_2',
      'pricing.comparison.landing_vision_3',
      'pricing.comparison.landing_vision_4',
    ],
  },
  {
    slug: 'pulse',
    nameKey: 'pricing.pulse.name',
    forKey: 'pricing.pulse.for',
    priceKey: 'pricing.pulse.price',
    features: [
      'pricing.comparison.landing_pulse_1',
      'pricing.comparison.landing_pulse_2',
      'pricing.comparison.landing_pulse_3',
      'pricing.comparison.landing_pulse_4',
      'pricing.comparison.landing_pulse_5',
      'pricing.comparison.landing_pulse_6',
      'pricing.comparison.landing_pulse_7',
      'pricing.comparison.landing_pulse_8',
    ],
    pulseStyle: true,
  },
  {
    slug: 'zenith',
    nameKey: 'pricing.zenith.name',
    forKey: 'pricing.zenith.for',
    priceKey: 'pricing.zenith.price',
    features: [
      'pricing.comparison.landing_zenith_1',
      'pricing.comparison.landing_zenith_2',
      'pricing.comparison.landing_zenith_3',
      'pricing.comparison.landing_zenith_4',
      'pricing.comparison.landing_zenith_5',
      'pricing.comparison.landing_zenith_6',
      'pricing.comparison.landing_zenith_7',
      'pricing.comparison.landing_zenith_8',
      'pricing.comparison.landing_zenith_10',
    ],
  },
];

export function LandingPricingSection() {
  const t = useTranslations('HomePage');
  const tPricing = useTranslations('PricingPage');
  const { billingCurrency } = useOptionalBillingCurrency();
  const [compareOpen, setCompareOpen] = useState(false);
  const billing = useBillingCycleOptional();
  const isAnnual = billing?.isAnnual ?? false;
  const planBasePrices = getPlanBasePricesForBillingCurrency(billingCurrency);
  const formatAmount = useFormatPricingMoney();

  const getBasePrice = (slug: PlanSlug) => planBasePrices[slug] ?? 0;

  const getMonthlyEquivalent = (slug: PlanSlug) => {
    const totalAnnual = calculatePrice(getBasePrice(slug), 1, true);
    return Math.round((totalAnnual / 12) * 100) / 100;
  };
  const getTotalAnnual = (slug: PlanSlug) => calculatePrice(getBasePrice(slug), 1, true);

  return (
    <section id="pricing" className="scroll-mt-28 py-16 sm:py-20 bg-muted/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl font-bold text-foreground mb-3">
            {t('pricing.headline')}
          </h2>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
        </div>

        <div className="flex justify-center mb-10">
          <HoverTooltip label={tPricing('tooltipBillingCycle')} side="top">
            <div className="inline-flex rounded-2xl outline-none" role="presentation">
              <BillingToggle
                annualBadge={tPricing('annualBadge')}
                monthlyLabel={tPricing('monthly')}
                annualLabel={tPricing('annual')}
              />
            </div>
          </HoverTooltip>
        </div>

        <div className="flex justify-center mb-10">
          <HoverTooltip label={tPricing('tooltipCompareAll')} side="top">
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary shadow-sm hover:bg-primary/10 hover:border-primary/40 transition-colors dark:bg-primary/10 dark:hover:bg-primary/15"
            >
              <Table2 className="w-4 h-4 shrink-0" aria-hidden />
              {tPricing('compareOpenButton')}
            </button>
          </HoverTooltip>
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
                  <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                    <HoverTooltip label={tPricing('tooltipBadgePulse')} side="bottom">
                      <span className="block cursor-help text-xs font-bold px-3 py-1 bg-white text-primary rounded-full">
                        {t('pricing.pulse.badge')}
                      </span>
                    </HoverTooltip>
                  </div>
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
                      <span className="text-sm font-normal opacity-80 ml-1">{tPricing('perMonth')}</span>
                    </motion.span>
                  </AnimatePresence>
                  {isAnnual && totalAnnual != null && (
                    <>
                      <p className={`text-xs mt-0.5 ${isPulse ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {tPricing('billedAnnuallyShort')} · {formatAmount(totalAnnual)}
                      </p>
                      {(() => {
                        const savings = calculateAnnualSavings(getBasePrice(plan.slug), 1);
                        if (savings <= 0) return null;
                        return (
                          <p
                            className={`inline-flex items-center gap-1.5 mt-1.5 text-sm font-semibold ${isPulse ? 'text-emerald-200' : 'text-green-600 dark:text-green-400'}`}
                            role="status"
                          >
                            <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                            {t('pricing.savingsPerYear', { amount: formatAmount(savings) })}
                          </p>
                        );
                      })()}
                    </>
                  )}
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((key) => (
                    <li key={key} className="flex items-start gap-2.5 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isPulse ? 'text-white' : 'text-primary'}`} aria-hidden />
                      <span className={isPulse ? 'text-white/80' : 'text-foreground/80'}>{t(key)}</span>
                    </li>
                  ))}
                </ul>

                <p className={`text-xs font-medium mt-4 mb-4 ${isPulse ? 'text-emerald-200' : 'text-emerald-600'}`}>{t('pricing.trialMention')}</p>
                <Link
                  href={`/signup?mode=checkout&plan=${plan.slug}&annual=${isAnnual ? '1' : '0'}&quantity=1`}
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
      <PricingCompareModal open={compareOpen} onClose={() => setCompareOpen(false)} />
    </section>
  );
}
