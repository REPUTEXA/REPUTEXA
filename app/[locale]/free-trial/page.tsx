'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Shield,
  Brain,
  TrendingUp,
  Bell,
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Lock,
  Gift,
} from 'lucide-react';
import {
  getFreeTrialPublicContent,
  type FreeTrialFeatureIconKey,
} from '@/lib/i18n/pages/free-trial-public-content';

const FEATURE_ICONS: Record<FreeTrialFeatureIconKey, typeof Brain> = {
  brain: Brain,
  shield: Shield,
  trendingUp: TrendingUp,
  bell: Bell,
  arrowRight: ArrowRight,
  zap: Zap,
};

const TRUST_ICON_MAP = {
  lock: Lock,
  shield: Shield,
  checkCircle: CheckCircle,
  star: Star,
} as const;

export default function FreeTrialPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getFreeTrialPublicContent(locale);

  return (
    <PublicPageShell title={t('freeTrial.title')} subtitle={t('freeTrial.subtitle')}>
      <div className="mb-14 rounded-2xl border border-[#2563eb]/40 bg-gradient-to-br from-[#2563eb]/15 to-[#1d4ed8]/5 p-8 text-center">
        <div className="flex justify-center mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2563eb]/20">
            <Gift className="w-8 h-8 text-[#2563eb]" />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {c.heroBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2563eb]/30 bg-[#2563eb]/10 px-3.5 py-1.5 text-xs font-medium text-[#2563eb]"
            >
              <CheckCircle className="w-3 h-3" />
              {badge}
            </span>
          ))}
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">{c.heroTitle}</h2>
        <p className="text-gray-400 text-sm mb-7 max-w-xl mx-auto leading-relaxed">{c.heroBody}</p>
        <Link
          href="/signup?mode=trial"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#2563eb] text-white font-bold text-lg hover:bg-[#1d4ed8] transition-colors shadow-lg"
        >
          <Zap className="w-5 h-5" />
          {c.heroCta}
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-xs text-gray-600 mt-4">{c.heroFootnote}</p>
      </div>

      <section className="mb-14">
        <h2 className="font-display text-xl font-bold text-white mb-6 text-center">{c.includedTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.trialFeatures.map(({ iconKey, label, desc }) => {
            const Icon = FEATURE_ICONS[iconKey];
            return (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20 mb-3">
                  <Icon className="w-4 h-4 text-[#2563eb]" />
                </div>
                <p className="font-semibold text-white text-sm mb-1">{label}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-xl font-bold text-white mb-6 text-center">{c.stepsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {c.steps.map(({ n, title, desc }) => (
            <div key={n} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb]/20 mx-auto mb-4">
                <span className="font-mono font-bold text-[#2563eb]">{n}</span>
              </div>
              <h3 className="font-display font-semibold text-white mb-1.5 text-sm">{title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-xl font-bold text-white mb-6 text-center">{c.miniTestimonialsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {c.testimonialsMini.map(({ name, role, quote, rating }) => (
            <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex mb-3">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-300 leading-relaxed mb-4 italic">&quot;{quote}&quot;</p>
              <p className="text-sm font-semibold text-white">{name}</p>
              <p className="text-xs text-gray-500">{role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="font-display text-xl font-bold text-white mb-6 text-center">{c.compareTitle}</h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-4 text-gray-500 font-medium">{c.tableFeatureCol}</th>
                <th className="px-4 py-4 text-gray-300 font-semibold text-center">{t('Pricing.plans.vision')}</th>
                <th className="px-4 py-4 text-[#2563eb] font-semibold text-center">{t('Pricing.plans.pulse')}</th>
                <th className="px-4 py-4 text-violet-400 font-semibold text-center">{t('Pricing.plans.zenith')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {c.plansCompare.map(({ feature, vision, pulse, zenith }) => (
                <tr key={feature} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 text-gray-400">{feature}</td>
                  <td className="px-4 py-3.5 text-center text-xs text-gray-400">{vision}</td>
                  <td className="px-4 py-3.5 text-center text-xs text-gray-300">{pulse}</td>
                  <td className="px-4 py-3.5 text-center text-xs text-violet-300 font-medium">{zenith}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-center gap-8 py-6 border-t border-white/10 flex-wrap">
        {c.trustLabels.map(({ key, label }) => {
          const Icon = TRUST_ICON_MAP[key];
          return (
            <div key={key} className="flex items-center gap-2 text-xs text-gray-500">
              <Icon className="w-4 h-4 text-gray-600" />
              {label}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/signup?mode=trial"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#2563eb] text-white font-bold text-lg hover:bg-[#1d4ed8] transition-colors"
        >
          {c.finalCta}
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-xs text-gray-600 mt-3">
          {c.loginPrompt}{' '}
          <Link href="/login" className="text-[#2563eb] hover:underline">
            {c.loginLink}
          </Link>
        </p>
      </div>
    </PublicPageShell>
  );
}
