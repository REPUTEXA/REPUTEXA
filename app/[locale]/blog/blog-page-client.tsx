'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { SubscribeForm } from '@/components/subscribe-form';
import { ArrowRight, Calendar, Clock, Tag } from 'lucide-react';

type Post = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  categoryKey: string;
  featured?: boolean;
};

type CategoryFilter = { key: string; label: string };

const CATEGORY_COLORS: Record<string, string> = {
  product: 'bg-blue-500/20 text-blue-400',
  trends: 'bg-violet-500/20 text-violet-400',
  regulation: 'bg-amber-500/20 text-amber-400',
  guide: 'bg-emerald-500/20 text-emerald-400',
  useCase: 'bg-cyan-500/20 text-cyan-400',
  seoLocal: 'bg-orange-500/20 text-orange-400',
  cybersecurity: 'bg-red-500/20 text-red-400',
  studies: 'bg-pink-500/20 text-pink-400',
  international: 'bg-teal-500/20 text-teal-400',
};

type Props = {
  posts: Post[];
};

export function BlogPageClient({ posts }: Props) {
  const tShell = useTranslations('PublicPages');
  const t = useTranslations('BlogPage');
  const filters = t.raw('categoryFilters') as CategoryFilter[];
  const [active, setActive] = useState('all');

  const { featured, gridPosts } = useMemo(() => {
    const filtered = posts.filter((p) => active === 'all' || p.categoryKey === active);
    const feat = filtered.find((p) => p.featured);
    const grid = filtered.filter((p) => p.slug !== feat?.slug);
    return { featured: feat, gridPosts: grid };
  }, [posts, active]);

  const categoryLabel = (key: string) => t(`categories.${key}` as Parameters<typeof t>[0]);

  return (
    <PublicPageShell title={tShell('blog.title')} subtitle={tShell('blog.subtitle')}>
      <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto">
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

      {featured && (
        <Link
          href={`/blog/${featured.slug}`}
          className="group mb-8 flex flex-col sm:flex-row gap-6 rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-7 hover:border-[#2563eb]/50 transition-all duration-300"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <span className="rounded-full bg-[#2563eb] px-3 py-1 text-xs font-bold text-white">
                {t('featuredBadge')}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[featured.categoryKey] ?? 'bg-gray-500/20 text-gray-400'}`}
              >
                {categoryLabel(featured.categoryKey)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {featured.date}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                {featured.readTime}
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-3 leading-tight group-hover:text-[#2563eb] transition-colors">
              {featured.title}
            </h2>
            <p className="text-gray-400 leading-relaxed mb-5 text-sm">{featured.excerpt}</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2563eb]">
              {t('readArticle')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </div>
        </Link>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {gridPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.categoryKey] ?? 'bg-gray-500/20 text-gray-400'}`}
              >
                <Tag className="w-2.5 h-2.5" />
                {categoryLabel(post.categoryKey)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
              <Calendar className="w-3.5 h-3.5" />
              <span>{post.date}</span>
              <span>·</span>
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readTime}</span>
            </div>
            <h2 className="font-display text-base font-semibold text-white mb-2 leading-snug group-hover:text-[#2563eb] transition-colors flex-1">
              {post.title}
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-4 line-clamp-2">{post.excerpt}</p>
            <span className="inline-flex items-center gap-1.5 text-sm text-[#2563eb] font-medium mt-auto">
              {t('readMore')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        ))}
      </div>

      <SubscribeForm />
    </PublicPageShell>
  );
}
