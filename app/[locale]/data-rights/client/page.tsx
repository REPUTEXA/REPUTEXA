import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicPageShell } from '@/components/public-page-shell';
import { EndClientErasureForm } from '@/components/data-rights/end-client-erasure-form';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.dataRightsClient' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
  const path = `/${locale}/data-rights/client`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: `${baseUrl}${path}` },
    robots: { index: true, follow: true },
  };
}

export default async function EndClientDataRightsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Legal.dataRightsClient' });

  return (
    <PublicPageShell title={t('title')} subtitle={t('subtitle')}>
      <EndClientErasureForm />
    </PublicPageShell>
  );
}
