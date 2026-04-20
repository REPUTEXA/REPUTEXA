'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { getFeatureMatrixForLocale } from '@/lib/i18n/features-matrix-bilingual';

const PLAN_COLORS: Record<string, string> = {
  VISION: 'bg-gray-500/20 text-gray-400',
  PULSE: 'bg-[#2563eb]/20 text-[#2563eb]',
  ZENITH: 'bg-violet-500/20 text-violet-400',
};

type Metric = { value: string; label: string; sub: string };
type PlanCard = {
  plan: string;
  price: string;
  color: string;
  badge: string;
  features: string[];
};

export default function FeaturesPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const tf = useTranslations('FeaturesPage');
  const metrics = tf.raw('metrics') as Metric[];
  const plansOverview = tf.raw('plansOverview') as PlanCard[];
  const matrix = getFeatureMatrixForLocale(locale);

  return (
    <PublicPageShell title={t('features.title')} subtitle={t('features.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        {metrics.map(({ value, label, sub }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="font-display text-lg sm:text-xl font-bold text-white mb-0.5">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-tight">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-12">
        {plansOverview.map(({ plan, price, color, badge, features }) => (
          <div key={plan} className={`rounded-2xl border p-5 ${color}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge}`}>{plan}</span>
              <span className="font-mono font-bold text-white">
                {price}
                <span className="text-xs font-normal text-gray-500">{tf('perMonth')}</span>
              </span>
            </div>
            <ul className="space-y-1.5">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-gray-400">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {matrix.map(({ id, icon: Icon, badge, badgeColor, title, subtitle, description, vision, pulse, zenith, capabilities, highlight }) => (
          <div
            key={id}
            className={`rounded-2xl border p-7 ${
              highlight
                ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-72 shrink-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563eb]/20">
                    <Icon className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeColor}`}>{badge}</span>
                </div>
                <h2 className="font-display text-lg font-bold text-white mb-1">{title}</h2>
                <p className="text-sm font-medium text-gray-400 mb-3">{subtitle}</p>
                <p className="text-xs text-gray-500 leading-relaxed mb-5">{description}</p>
                <div className="flex flex-wrap gap-2">
                  {vision && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_COLORS.VISION}`}>{t('Pricing.plans.vision')}</span>
                  )}
                  {pulse && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_COLORS.PULSE}`}>{t('Pricing.plans.pulse')}</span>
                  )}
                  {zenith && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PLAN_COLORS.ZENITH}`}>{t('Pricing.plans.zenith')}</span>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="grid gap-3 sm:grid-cols-2">
                  {capabilities.map(({ icon: CapIcon, label, plan }) => (
                    <div key={label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <CapIcon className="w-4 h-4 text-[#2563eb] mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs text-gray-400 leading-relaxed">{label}</span>
                        <span className={`ml-2 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${PLAN_COLORS[plan]}`}>{plan}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-[#2563eb]/30 bg-[#2563eb]/10 p-8 text-center">
        <h3 className="font-display text-2xl font-bold text-white mb-3">{tf('ctaTitle')}</h3>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto text-sm leading-relaxed">{tf('ctaBody')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup?mode=trial"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#2563eb] text-white font-bold hover:bg-[#1d4ed8] transition-colors"
          >
            {tf('ctaTrial')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
          >
            {tf('ctaPricing')}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
