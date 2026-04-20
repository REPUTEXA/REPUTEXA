import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';
import { DefiReputexaClient } from '@/components/dashboard/defi-reputexa-client';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard.defiReputexa' });
  return { title: t('metaTitle') };
}

export default async function DefiReputexaPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', user.id)
    .maybeSingle();
  if (!canAccessReputexaChallenge(profile?.subscription_plan)) {
    redirect(`/${locale}/dashboard`);
  }
  return (
    <div className="min-h-[70vh]">
      <DefiReputexaClient />
    </div>
  );
}
