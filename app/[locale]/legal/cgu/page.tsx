import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { LegalSection, LegalRichText, legalSectionKey } from '@/components/legal/legal-section';
import { LegalPublishedHtml } from '@/components/legal/legal-published-html';
import {
  getPublishedLegalDocument,
  pickPublishedHtmlForLocale,
} from '@/lib/legal/public-document';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.cgu' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/legal/cgu' : `/${locale}/legal/cgu`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: { title: t('metaTitle'), description: t('metaDescription'), url: `${baseUrl}${path}`, siteName: 'REPUTEXA' },
  };
}

export default async function CGUPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.cgu' });
  const tNav = await getTranslations({ locale, namespace: 'Legal.nav' });
  const tocRaw = t.raw('toc') as Array<{ id: string; label: string }>;
  const toc = Array.isArray(tocRaw) ? tocRaw : [];

  const published = await getPublishedLegalDocument('cgu');
  const publishedHtml = published ? pickPublishedHtmlForLocale(published, locale) : null;
  if (published && publishedHtml) {
    const effectiveLabel = new Date(published.effective_date).toLocaleDateString(
      locale === 'en' ? 'en-GB' : 'fr-FR',
      { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    );
    return (
      <LegalPageShell title={t('title')} toc={[]} tocLabel={tNav('toc')}>
        <LegalPublishedHtml
          html={publishedHtml}
          version={published.version}
          effectiveDateLabel={effectiveLabel}
          locale={locale}
        />
      </LegalPageShell>
    );
  }

  return (
    <LegalPageShell title={t('title')} toc={toc} tocLabel={tNav('toc')}>
      <p className="legal-doc-intro text-slate-600 dark:text-slate-400 mb-10 border-b border-slate-200/90 dark:border-slate-800/90 pb-8">
        {t('intro')}
      </p>
      {toc.map(({ id }) => {
        const key = legalSectionKey(id);
        return (
          <LegalSection key={id} id={id} title={t(`${key}_title`)}>
            <LegalRichText content={t(`${key}_content`)} />
          </LegalSection>
        );
      })}
    </LegalPageShell>
  );
}
