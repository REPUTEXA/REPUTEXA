import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.adminCompliance' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default function AdminComplianceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
