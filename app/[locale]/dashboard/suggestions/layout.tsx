import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requirePlanForRoute } from '@/lib/plan-route-guard';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Suggestions' });
  return {
    title: t('page.metaTitle'),
    description: t('page.metaDescription'),
  };
}

export default async function SuggestionsLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePlanForRoute('pulse', locale);
  return <>{children}</>;
}
