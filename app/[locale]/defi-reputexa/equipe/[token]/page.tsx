import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReputexaTeamBoardClient } from '@/components/defi/reputexa-team-board-client';

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PublicDefiTeam' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function ReputexaTeamBoardPage({ params }: Props) {
  const { locale, token } = await params;
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <ReputexaTeamBoardClient token={token} locale={locale} />
    </div>
  );
}
