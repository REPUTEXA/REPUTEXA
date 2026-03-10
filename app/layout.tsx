import type { Metadata } from 'next';
import { headers } from 'next/headers';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { ThemeProviderRouteAware } from '@/components/theme-provider-route-aware';
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
  title: 'REPUTEXA - Your 24/7 Customer Relationship Director',
  description: 'Automate feedback, prevent negative reviews, and elevate your restaurant brand with AI. The ultimate reputation shield for restaurant owners.',
  openGraph: {
    title: 'REPUTEXA - Your 24/7 Customer Relationship Director',
    description: 'Automate feedback, prevent negative reviews, and elevate your restaurant brand with AI.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'en';
  const dir = ['ar', 'he'].includes(locale) ? 'rtl' : 'ltr';

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Reputexa',
    url: 'https://reputexa.fr',
    logo: 'https://reputexa.fr/logo.png',
    description: 'Solution IA de gestion de réputation pour commerçants et restaurateurs.',
    sameAs: ['https://www.instagram.com/reputexaa/'],
  };

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased transition-colors duration-200`}
      >
        <ThemeProviderRouteAware>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProviderRouteAware>
      </body>
    </html>
  );
}
