'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Leaf,
  Server,
  Scale,
  Eye,
  Users,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Globe,
  Heart,
} from 'lucide-react';
import {
  getSustainabilityPublicContent,
  type SustainabilityPillarIconKey,
} from '@/lib/i18n/pages/sustainability-public-content';

const PILLAR_ICONS: Record<SustainabilityPillarIconKey, typeof Server> = {
  server: Server,
  scale: Scale,
  eye: Eye,
  users: Users,
  shieldCheck: ShieldCheck,
};

export default function SustainabilityPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getSustainabilityPublicContent(locale);

  return (
    <PublicPageShell title={t('sustainability.title')} subtitle={t('sustainability.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        {c.metrics.map(({ value, label }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-7">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
            <Leaf className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 className="font-display font-bold text-white">{c.manifestTitle}</h2>
        </div>
        <p className="text-gray-300 leading-relaxed text-lg">&quot;{c.manifestQuote}&quot;</p>
        <p className="text-sm text-gray-500 mt-3">{c.manifestAttribution}</p>
      </div>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-8">{c.pillarsSectionTitle}</h2>
        <div className="space-y-5">
          {c.pillars.map(({ iconKey, title, color, bgColor, description, points }) => {
            const Icon = PILLAR_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgColor}`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {points.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-8">{c.roadmapTitle}</h2>
        <div className="relative">
          <div className="absolute left-[3.2rem] top-0 bottom-0 w-px bg-white/10 hidden sm:block" />
          <div className="space-y-4">
            {c.roadmap.map(({ year, title, desc }) => (
              <div key={year + title} className="relative flex gap-5 rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]/20 z-10">
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

      <div className="rounded-2xl border border-white/10 bg-white/5 p-7 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20">
            <Heart className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
        <h3 className="font-display font-bold text-white mb-2">{c.ctaTitle}</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto">{c.ctaBody}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
          >
            {c.ctaPrimary}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-gray-300 font-medium hover:bg-white/5 transition-colors"
          >
            <Globe className="w-4 h-4" />
            {c.ctaSecondary}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
