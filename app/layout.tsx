import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { ThemeProviderRouteAware } from '@/components/theme-provider-route-aware';
import { EstablishmentQueryProvider } from '@/lib/establishment-query-provider';
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

export const metadata: Metadata = {
  metadataBase: new URL('https://reputexa.fr'),
  icons: { icon: '/logo.png' },
  title: 'REPUTEXA | Votre Directeur de la Relation Client 24/7',
  description:
    "Automatisez vos avis, protégez votre e-réputation et boostez votre chiffre d'affaires grâce à l'IA.",
  openGraph: {
    title: 'REPUTEXA | Votre Directeur de la Relation Client 24/7',
    description:
      "Automatisez vos avis, protégez votre e-réputation et boostez votre chiffre d'affaires grâce à l'IA.",
    siteName: 'REPUTEXA',
    url: 'https://reputexa.fr',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'fr';
  const dir = ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr';

  const baseUrl = 'https://reputexa.fr';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'REPUTEXA',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      "Solution IA de gestion de réputation pour commerçants et restaurateurs.",
    sameAs: ['https://www.instagram.com/reputexaa/'],
  };

  const siteNavigationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: ['Dashboard', 'Prix', 'Contact'],
    url: [
      `${baseUrl}/${locale}/dashboard`,
      `${baseUrl}/${locale}/pricing`,
      `${baseUrl}/${locale}/contact`,
    ],
  };

  const webSiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'REPUTEXA',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
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
