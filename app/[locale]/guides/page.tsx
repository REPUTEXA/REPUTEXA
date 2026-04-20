'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  BookOpen,
  BarChart2,
  Shield,
  MessageSquare,
  Zap,
  Globe,
  Bell,
  FileText,
  ArrowRight,
  Clock,
  ChevronRight,
} from 'lucide-react';

type Guide = {
  slug: string;
  icon: string;
  title: string;
  description: string;
  readTime: string;
  levelKey: string;
  categoryKey: string;
  featured?: boolean;
};

type Stat = { value: string; label: string };
type CategoryFilter = { key: string; label: string };

const GUIDE_ICONS: Record<string, React.ElementType> = {
  zap: Zap,
  barChart2: BarChart2,
  messageSquare: MessageSquare,
  shield: Shield,
  bell: Bell,
  globe: Globe,
  fileText: FileText,
  bookOpen: BookOpen,
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-500/20 text-emerald-400',
  intermediate: 'bg-[#2563eb]/20 text-[#2563eb]',
  advanced: 'bg-violet-500/20 text-violet-400',
};

const CATEGORY_COLORS: Record<string, string> = {
  firstSteps: 'text-emerald-400',
  strategy: 'text-blue-400',
  ai: 'text-violet-400',
  compliance: 'text-amber-400',
  shield: 'text-red-400',
  multi: 'text-cyan-400',
  analytics: 'text-pink-400',
  api: 'text-orange-400',
};

export default function GuidesPage() {
  const tShell = useTranslations('PublicPages');
  const t = useTranslations('GuidesPage');
  const stats = t.raw('stats') as Stat[];
  const filters = t.raw('categoryFilters') as CategoryFilter[];
  const guides = t.raw('guides') as Guide[];
  const [active, setActive] = useState('all');

  const { featured, gridGuides } = useMemo(() => {
    const filtered = guides.filter((g) => active === 'all' || g.categoryKey === active);
    const feat = filtered.find((g) => g.featured);
    const grid = filtered.filter((g) => g.slug !== feat?.slug);
    return { featured: feat, gridGuides: grid };
  }, [guides, active]);

  const levelLabel = (key: string) => t(`levels.${key}` as Parameters<typeof t>[0]);

  return (
    <PublicPageShell title={tShell('guides.title')} subtitle={tShell('guides.subtitle')}>
      <div className="grid grid-cols-3 gap-4 mb-10">
        {stats.map(({ value, label }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="font-display text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active === key
                ? 'bg-[#2563eb] text-white'
                : 'border border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {featured && (() => {
        const Icon = GUIDE_ICONS[featured.icon] ?? Zap;
        return (
          <Link
            href={`/guides/${featured.slug}`}
            className="group mb-8 flex items-start gap-5 rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-7 hover:border-[#2563eb]/50 transition-all duration-300"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/20">
              <Icon className="w-7 h-7 text-[#2563eb]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <span className="rounded-full bg-[#2563eb] px-3 py-1 text-xs font-bold text-white">
                  {t('featuredBadge')}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_COLORS[featured.levelKey] ?? 'bg-gray-500/20 text-gray-400'}`}
                >
                  {levelLabel(featured.levelKey)}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {featured.readTime}
                </span>
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2 group-hover:text-[#2563eb] transition-colors">
                {featured.title}
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">{featured.description}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb]">
                {t('readGuide')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        );
      })()}

      <div className="grid gap-4 sm:grid-cols-2">
        {gridGuides.map(({ slug, icon, title, description, readTime, levelKey, categoryKey }) => {
          const Icon = GUIDE_ICONS[icon] ?? BookOpen;
          return (
            <Link
              key={slug}
              href={`/guides/${slug}`}
              className="group flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/20">
                <Icon className="w-5 h-5 text-[#2563eb]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-xs font-medium ${CATEGORY_COLORS[categoryKey] ?? 'text-gray-400'}`}>
                    {filters.find((f) => f.key === categoryKey)?.label ?? categoryKey}
                  </span>
                  <span className="text-gray-700">·</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[levelKey] ?? 'bg-gray-500/20 text-gray-400'}`}
                  >
                    {levelLabel(levelKey)}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-500 shrink-0">
                    <Clock className="w-3 h-3" />
                    {readTime}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-white mb-1.5 text-sm leading-snug group-hover:text-[#2563eb] transition-colors">
                  {title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 mt-1 group-hover:text-[#2563eb] group-hover:translate-x-0.5 transition-all" />
            </Link>
          );
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-7 flex flex-col sm:flex-row items-center gap-5">
        <div>
          <h3 className="font-display font-bold text-white mb-1">{t('ctaTitle')}</h3>
          <p className="text-sm text-gray-400">{t('ctaBody')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Link
            href="/signup?mode=trial"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors whitespace-nowrap"
          >
            {t('ctaTrial')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 text-gray-300 font-medium text-sm hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            {t('ctaHelp')}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
