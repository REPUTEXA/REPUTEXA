'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Shield,
  Brain,
  Globe,
  ArrowRight,
  CheckCircle,
  TrendingUp,
  Heart,
  Scale,
  Zap,
  Users,
  Star,
  Award,
} from 'lucide-react';
import {
  getAboutPublicContent,
  type AboutAchievementIconKey,
  type AboutValueIconKey,
} from '@/lib/i18n/pages/about-public-content';

const VALUE_ICONS: Record<AboutValueIconKey, typeof Brain> = {
  brain: Brain,
  scale: Scale,
  shield: Shield,
  heart: Heart,
};

const ACHIEVEMENT_ICONS: Record<AboutAchievementIconKey, typeof Star> = {
  star: Star,
  trendingUp: TrendingUp,
  globe: Globe,
};

export default function AboutPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getAboutPublicContent(locale);

  return (
    <PublicPageShell title={t('about.title')} subtitle={t('about.subtitle')}>
      {/* Mission statement */}
      <div className="mb-16 rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
            <Award className="w-5 h-5 text-[#2563eb]" />
          </div>
          <span className="text-sm font-semibold text-[#2563eb] uppercase tracking-wider">{c.missionEyebrow}</span>
        </div>
        <p className="text-xl sm:text-2xl text-white font-light leading-relaxed">&quot;{c.missionQuote}&quot;</p>
        <p className="text-gray-500 text-sm mt-4">{c.missionAttribution}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        {c.metrics.map(({ value, label }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{label}</p>
          </div>
        ))}
      </div>

      {/* Story */}
      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.storyTitle}</h2>
        <div className="space-y-4 text-gray-400 leading-relaxed">
          {c.storyParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-8">{c.valuesTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {c.values.map(({ iconKey, title, description }) => {
            const Icon = VALUE_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
                    <Icon className="w-4 h-4 text-[#2563eb]" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">{title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Timeline */}
      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-8">{c.timelineTitle}</h2>
        <div className="relative">
          <div className="absolute left-[4.2rem] top-0 bottom-0 w-px bg-white/10 hidden sm:block" />
          <div className="space-y-4">
            {c.timeline.map(({ year, title, desc }) => (
              <div key={year + title} className="relative flex gap-5 rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-12 w-24 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]/20 z-10">
                  <span className="text-xs font-bold text-[#2563eb] text-center leading-tight">{year}</span>
                </div>
                <div>
                  <p className="font-semibold text-white mb-0.5 text-sm">{title}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mb-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
              <Users className="w-4 h-4 text-[#2563eb]" />
            </div>
            <h2 className="font-display font-bold text-white">{c.teamTitle}</h2>
            <span className="ml-auto text-xs text-gray-500">{c.teamMeta}</span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-5">{c.teamIntro}</p>
          <ul className="space-y-2.5">
            {c.teamValues.map((v) => (
              <li key={v} className="flex items-center gap-2.5 text-sm text-gray-400">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                {v}
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-5 border-t border-white/10">
            <Link
              href="/careers"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#2563eb] hover:underline"
            >
              {c.careersLink}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.achievementsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {c.achievements.map(({ iconKey, title, desc }) => {
            const Icon = ACHIEVEMENT_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
                    <Icon className="w-5 h-5 text-[#2563eb]" />
                  </div>
                </div>
                <p className="font-display font-bold text-white text-sm mb-1">{title}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/signup?mode=trial"
          className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#2563eb] text-white font-bold hover:bg-[#1d4ed8] transition-colors"
        >
          <Zap className="w-4 h-4" />
          {c.ctaTrial}
        </Link>
        <Link
          href="/contact"
          className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
        >
          {c.ctaContact}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/investors"
          className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
        >
          {c.ctaInvestors}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </PublicPageShell>
  );
}
