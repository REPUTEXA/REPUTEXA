import { setRequestLocale } from 'next-intl/server';
import { requirePlanForRoute } from '@/lib/plan-route-guard';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function GrowthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePlanForRoute('zenith', locale);
  return <>{children}</>;
}
