import { setRequestLocale } from 'next-intl/server';
import { requirePlanForRoute } from '@/lib/plan-route-guard';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AlertsLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePlanForRoute('pulse', locale);
  return <>{children}</>;
}
