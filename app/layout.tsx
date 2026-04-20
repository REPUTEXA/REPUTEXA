import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { ThemeProviderRouteAware } from '@/components/theme-provider-route-aware';
import { EstablishmentQueryProvider } from '@/lib/establishment-query-provider';
import { getBrandName, getOrganizationInstagramUrl, getSiteUrl } from '@/src/lib/empire-settings';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
});

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'fr';
  const t = await getTranslations({ locale, namespace: 'RootLayout' });
  const brandName = getBrandName();
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      title: brandName,
      statusBarStyle: 'default',
    },
    icons: {
      icon: [
        { url: '/logo-hd.png', sizes: '32x32', type: 'image/png' },
        { url: '/reputexa-mark.svg', type: 'image/svg+xml' },
        { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      ],
      apple: '/logo-hd.png',
    },
    title: t('metaTitle'),
    description: t('metaDescription'),
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      siteName: brandName,
      url: siteUrl,
      images: [{ url: '/logo-hd.png', width: 512, height: 512, alt: t('ogImageAlt') }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'fr';
  const dir = ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr';

  const baseUrl = getSiteUrl();
  const brandName = getBrandName();
  const t = await getTranslations({ locale, namespace: 'RootLayout' });

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brandName,
    url: baseUrl,
    logo: `${baseUrl}/reputexa-mark.svg`,
    description: t('schemaOrganizationDescription'),
    sameAs: [getOrganizationInstagramUrl()],
  };

  const siteNavigationSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'SiteNavigationElement',
        position: 1,
        name: t('schemaNavDashboard'),
        url: `${baseUrl}/${locale}/dashboard`,
      },
      {
        '@type': 'SiteNavigationElement',
        position: 2,
        name: t('schemaNavPricing'),
        url: `${baseUrl}/${locale}/pricing`,
      },
      {
        '@type': 'SiteNavigationElement',
        position: 3,
        name: t('schemaNavContact'),
        url: `${baseUrl}/${locale}/contact`,
      },
      {
        '@type': 'SiteNavigationElement',
        position: 4,
        name: t('schemaNavSignIn'),
        url: `${baseUrl}/${locale}/login`,
      },
    ],
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brandName,
    url: `${baseUrl}/${locale}`,
    inLanguage: locale,
  };

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased transition-colors duration-200`}
      >
        <EstablishmentQueryProvider>
          <ThemeProviderRouteAware>
            {children}
            <Toaster richColors position="top-center" />
          </ThemeProviderRouteAware>
        </EstablishmentQueryProvider>
      </body>
    </html>
  );
}
