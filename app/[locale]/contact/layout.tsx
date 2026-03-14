import type { Metadata } from 'next';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/contact' : `/${locale}/contact`;
  return {
    title: 'Support & Contact | REPUTEXA',
    description:
      'Contactez l\'équipe REPUTEXA pour le support, la facturation ou les partenariats. Réponse sous 24h.',
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: 'Support & Contact | REPUTEXA',
      description: 'Contactez REPUTEXA : support, facturation, partenariats. contact@reputexa.fr',
      url: `${baseUrl}${path}`,
      siteName: 'Reputexa',
    },
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
