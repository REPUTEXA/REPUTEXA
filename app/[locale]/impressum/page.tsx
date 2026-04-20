import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPageShell } from '@/components/legal/legal-page-shell';
import { REPUTEXA_SITE_URL } from '@/lib/seo/reputexa-base-url';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.impressum' });
  const path = locale === 'fr' ? '/fr/impressum' : `/${locale}/impressum`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: `${REPUTEXA_SITE_URL}${path}` },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `${REPUTEXA_SITE_URL}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

function envBlock(value: string | undefined, placeholder: string) {
  const v = value?.trim();
  if (v) {
    return (
      <div className="whitespace-pre-line text-slate-800 dark:text-slate-100 text-sm leading-relaxed">{v}</div>
    );
  }
  return <p className="text-sm text-amber-700 dark:text-amber-400/90 italic">{placeholder}</p>;
}

export default async function ImpressumPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Legal.impressum' });

  const legalName = process.env.NEXT_PUBLIC_IMPRESSUM_LEGAL_NAME?.trim();
  const address = process.env.NEXT_PUBLIC_IMPRESSUM_ADDRESS?.trim();
  const contact = process.env.NEXT_PUBLIC_IMPRESSUM_CONTACT?.trim();
  const vat = process.env.NEXT_PUBLIC_IMPRESSUM_VAT?.trim();

  return (
    <LegalPageShell title={t('title')} toc={[]}>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10 max-w-3xl text-sm border-b border-slate-200/90 dark:border-slate-800/90 pb-8">
        {t('intro')}
      </p>

      <section className="mb-10 space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t('fieldName')}</h2>
        {envBlock(legalName, t('placeholderName'))}
      </section>

      <section className="mb-10 space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t('fieldAddress')}</h2>
        {envBlock(address, t('placeholderAddress'))}
      </section>

      <section className="mb-10 space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t('fieldContact')}</h2>
        {envBlock(contact, t('placeholderContact'))}
      </section>

      <section className="mb-10 space-y-2">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{t('fieldVat')}</h2>
        {envBlock(vat, t('placeholderVat'))}
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">{t('vatNote')}</p>
      </section>
    </LegalPageShell>
  );
}
