import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.confidentialite' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/legal/confidentialite' : `/${locale}/legal/confidentialite`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: { title: t('metaTitle'), description: t('metaDescription'), url: `${baseUrl}${path}`, siteName: 'REPUTEXA' },
  };
}

function sectionKey(id: string): string {
  return id.replace(/-/g, '_');
}

export default async function ConfidentialitePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.confidentialite' });
  const tNav = await getTranslations({ locale, namespace: 'Legal.nav' });
  const tocRaw = t.raw('toc') as Array<{ id: string; label: string }>;
  const toc = Array.isArray(tocRaw) ? tocRaw : [];
  const navLinks = [
    { href: '/legal/mentions-legales', label: tNav('mentions') },
    { href: '/legal/confidentialite', label: tNav('privacy') },
    { href: '/legal/cgu', label: tNav('terms') },
    { href: '/contact', label: tNav('contact') },
  ];

  return (
    <LegalPageShell title={t('title')} toc={toc} navLinks={navLinks} tocLabel={tNav('toc')}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">{t('intro')}</p>
      {toc.map(({ id }) => {
        const key = sectionKey(id);
        const titleKey = `${key}_title`;
        const contentKey = `${key}_content`;
        return (
          <section key={id} id={id} className="mb-10">
            <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
              {t(titleKey)}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {t(contentKey)}
            </p>
          </section>
        );
      })}
    </LegalPageShell>
  );
}
