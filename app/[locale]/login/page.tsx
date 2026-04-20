import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { REPUTEXA_SITE_URL } from '@/lib/seo/reputexa-base-url';
import { BrandPageLoader } from '@/components/brand/brand-page-loader';
import { LoginPageClient } from './login-page-client';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'LoginPage.seo' });
  const localePath = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? `/${locale}`
    : '/fr';
  const url = `${REPUTEXA_SITE_URL}${localePath}/login`;
  const title = t('title');
  const description = t('description');

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'REPUTEXA',
      type: 'website',
      images: [{ url: '/logo-hd.png', width: 512, height: 512, alt: 'REPUTEXA' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo-hd.png'],
    },
    robots: { index: true, follow: true },
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<BrandPageLoader />}>
      <LoginPageClient />
    </Suspense>
  );
}
