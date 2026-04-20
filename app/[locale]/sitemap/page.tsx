'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';

type Section = { title: string; links: { href: string; label: string }[] };

export default function SitemapPage() {
  const t = useTranslations('PublicPages');
  const sections = t.raw('sitemapSections') as Section[];
  return (
    <PublicPageShell title={t('sitemap.title')} subtitle={t('sitemap.subtitle')}>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="font-display font-semibold text-white mb-4">{section.title}</h3>
            <ul className="space-y-2">
              {section.links.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-gray-400 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PublicPageShell>
  );
}
