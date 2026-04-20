'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { Calendar, ArrowRight, Newspaper, Megaphone, Package } from 'lucide-react';
import { getNewsPublicContent, type NewsItem } from '@/lib/i18n/pages/news-public-content';

const TYPE_ICONS: Record<NewsItem['type'], React.ElementType> = {
  press: Newspaper,
  product: Package,
  milestone: Megaphone,
};

const TYPE_COLORS: Record<NewsItem['type'], string> = {
  press: 'bg-violet-500/20 text-violet-400',
  product: 'bg-blue-500/20 text-blue-400',
  milestone: 'bg-emerald-500/20 text-emerald-400',
};

export default function NewsPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getNewsPublicContent(locale);
  const featured = c.items.find((n) => n.featured);
  const rest = c.items.filter((n) => !n.featured);
  const filters = [c.filterAll, c.filterProduct, c.filterPress, c.filterMilestones];

  return (
    <PublicPageShell title={t('news.title')} subtitle={t('news.subtitle')}>
      <div className="flex flex-wrap gap-2 mb-10">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              f === c.filterAll
                ? 'bg-[#2563eb] text-white'
                : 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {featured && (
        <div className="mb-8 rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-7 sm:p-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="rounded-full bg-[#2563eb] px-3 py-1 text-xs font-bold text-white">{c.featuredLabel}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[featured.type]}`}>
              {featured.badge}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {featured.date}
            </span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3 leading-tight">{featured.title}</h2>
          <p className="text-gray-400 leading-relaxed mb-6 max-w-3xl">{featured.excerpt}</p>
          <Link href="/contact" className="inline-flex items-center gap-2 text-sm font-medium text-[#2563eb] hover:underline">
            {c.readMore}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map(({ id, type, badge, date, title, excerpt }) => {
          const TypeIcon = TYPE_ICONS[type];
          return (
            <div
              key={id}
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}
                >
                  <TypeIcon className="w-3 h-3" />
                  {badge}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                <Calendar className="w-3.5 h-3.5" />
                {date}
              </div>
              <h3 className="font-display font-semibold text-white mb-2 leading-snug group-hover:text-[#2563eb] transition-colors flex-1">
                {title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-3">{excerpt}</p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563eb] hover:underline mt-auto"
              >
                {c.readMore} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-7 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2563eb]/20">
          <Newspaper className="w-7 h-7 text-[#2563eb]" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-display font-bold text-white mb-1">{c.pressTitle}</h3>
          <p className="text-sm text-gray-400">{c.pressBody}</p>
        </div>
        <Link
          href="/contact"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors"
        >
          {c.pressCta}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </PublicPageShell>
  );
}
