import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ContactLayout' });
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/contact' : `/${locale}/contact`;
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.ogDescription'),
      url: `${baseUrl}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
