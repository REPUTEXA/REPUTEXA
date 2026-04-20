import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { getTranslations, setRequestLocale } from 'next-intl/server';

const whatsappReviewInter = Inter({
  subsets: ['latin'],
  variable: '--font-whatsapp-review-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.whatsappReviewMeta' });
  return {
    title: t('title'),
    description: t('description'),
    appleWebApp: {
      capable: true,
      title: t('appleTitle'),
      statusBarStyle: 'black-translucent',
    },
  };
}

export default function WhatsappReviewDashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className={whatsappReviewInter.variable}>{children}</div>;
}
