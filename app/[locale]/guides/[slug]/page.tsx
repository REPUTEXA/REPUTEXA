'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { ArrowLeft } from 'lucide-react';

type PageContent = { title: string; content: string };

export default function GuidePage() {
  const t = useTranslations('PublicPages');
  const tSlug = useTranslations('GuidesSlug');
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const pages = tSlug.raw('pages') as Record<string, PageContent>;
  const guide = pages[slug];

  if (!guide) {
    return (
      <PublicPageShell title={t('guidesSlug.notFoundTitle')}>
        <div className="text-center py-16">
          <p className="text-gray-400 mb-6">{t('guidesSlug.notFoundBody')}</p>
          <Link href="/guides" className="text-[#2563eb] hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> {t('guidesSlug.backToGuides')}
          </Link>
        </div>
      </PublicPageShell>
    );
  }

  return (
    <PublicPageShell title={guide.title}>
      <article className="max-w-3xl mx-auto">
        <Link href="/guides" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t('guidesSlug.backToGuides')}
        </Link>
        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
          <p>{guide.content}</p>
        </div>
      </article>
    </PublicPageShell>
  );
}
