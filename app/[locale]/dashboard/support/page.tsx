import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SupportAiChat } from '@/components/dashboard/support-ai-chat';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard.support' });
  return {
    title: t('metaTitle'),
  };
}

export default async function SupportPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <SupportAiChat />
    </div>
  );
}
