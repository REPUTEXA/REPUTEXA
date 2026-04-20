import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { HomePageClient } from '@/components/landing/home-page-client';
import { getApprovedReputexaPlatformReviewsForLanding } from '@/lib/reputexa-platform-reviews/landing-data';
import { REPUTEXA_SITE_URL } from '@/lib/seo/reputexa-base-url';

type Props = {
  params: Promise<{ locale: string }>;
};

const OG_LOCALE: Record<string, string> = {
  fr: 'fr_FR',
  en: 'en_US',
  'en-gb': 'en_GB',
  es: 'es_ES',
  de: 'de_DE',
  it: 'it_IT',
  pt: 'pt_PT',
  ja: 'ja_JP',
  zh: 'zh_CN',
};

/** BCP 47 tags for `alternates.languages` (hreflang). */
const HREFLANG: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  'en-gb': 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'HomePage.seo' });
  const localePath = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? `/${locale}`
    : '/fr';
  const url = `${REPUTEXA_SITE_URL}${localePath}`;
  const title = t('title');
  const description = t('description');

  const languageAlternates: Record<string, string> = {
    'x-default': `${REPUTEXA_SITE_URL}/fr`,
    ...Object.fromEntries(
      routing.locales.map((code) => [HREFLANG[code] ?? code, `${REPUTEXA_SITE_URL}/${code}`]),
    ),
  };

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'REPUTEXA',
      type: 'website',
      locale: OG_LOCALE[locale] ?? OG_LOCALE.fr,
      images: [{ url: '/logo-hd.png', width: 512, height: 512, alt: 'REPUTEXA' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo-hd.png'],
    },
  };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'HomePage.seo' });
  const localePath = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? `/${locale}`
    : '/fr';
  const pageUrl = `${REPUTEXA_SITE_URL}${localePath}`;

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('title'),
    description: t('description'),
    url: pageUrl,
    inLanguage: locale,
    isPartOf: {
      '@type': 'WebSite',
      name: 'REPUTEXA',
      url: REPUTEXA_SITE_URL,
    },
  };

  const platformReviewCards = await getApprovedReputexaPlatformReviewsForLanding();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <HomePageClient platformReviewCards={platformReviewCards} />
    </>
  );
}
