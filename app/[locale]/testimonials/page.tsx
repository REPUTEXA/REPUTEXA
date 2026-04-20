'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { Star, ArrowRight, Quote, TrendingUp } from 'lucide-react';
import { getTestimonialsPublicContent } from '@/lib/i18n/pages/testimonials-public-content';

const PLAN_COLORS: Record<string, string> = {
  VISION: 'bg-gray-500/20 text-gray-300',
  PULSE: 'bg-[#2563eb]/20 text-[#2563eb]',
  ZENITH: 'bg-violet-500/20 text-violet-400',
};

export default function TestimonialsPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getTestimonialsPublicContent(locale);
  const featured = c.items.find((x) => x.featured);
  const rest = c.items.filter((x) => !x.featured);
  const sectors = Array.from(new Set(c.items.map((item) => item.sector)));

  return (
    <PublicPageShell title={t('testimonials.title')} subtitle={t('testimonials.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
        {c.globalMetrics.map(({ value, label }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-10">
        <span className="rounded-full bg-[#2563eb] px-4 py-1.5 text-xs font-medium text-white">{c.allSectorsLabel}</span>
        {sectors.map((s) => (
          <span
            key={s}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            {s}
          </span>
        ))}
      </div>

      {featured && (
        <div className="mb-8 rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-7 sm:p-8">
          <div className="flex items-start gap-4">
            <Quote className="w-8 h-8 text-[#2563eb]/50 shrink-0 mt-1" />
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex">
                  {Array.from({ length: featured.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PLAN_COLORS[featured.plan]}`}>
                  {featured.plan}
                </span>
                <span className="text-xs text-gray-500">
                  {featured.sector} · {featured.location}
                </span>
              </div>
              <p className="text-lg text-gray-200 leading-relaxed mb-5 font-light italic">&quot;{featured.quote}&quot;</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div>
                  <p className="font-semibold text-white">{featured.name}</p>
                  <p className="text-sm text-gray-500">
                    {featured.role} · {featured.company}
                  </p>
                </div>
                <div className="sm:ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">{featured.result}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map(({ id, name, role, company, sector, location, rating, quote, result, plan }) => (
          <div
            key={id}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col hover:bg-white/[0.07] transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex">
                {Array.from({ length: rating }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PLAN_COLORS[plan]}`}>{plan}</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed mb-4 flex-1 italic">&quot;{quote}&quot;</p>
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 mb-3">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">{result}</span>
              </div>
              <p className="font-semibold text-white text-sm">{name}</p>
              <p className="text-xs text-gray-500">
                {role} · {company}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {sector} · {location}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-[#2563eb]/30 bg-[#2563eb]/10 p-8 text-center">
        <h3 className="font-display text-2xl font-bold text-white mb-3">{c.ctaTitle}</h3>
        <p className="text-gray-400 mb-6 max-w-xl mx-auto text-sm leading-relaxed">{c.ctaBody}</p>
        <Link
          href="/signup?mode=trial"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#2563eb] text-white font-bold hover:bg-[#1d4ed8] transition-colors"
        >
          {c.ctaButton}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </PublicPageShell>
  );
}
