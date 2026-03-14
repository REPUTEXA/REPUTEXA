import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function ChoosePlanLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single();

  if (profile) {
    const status = profile.subscription_status;
    const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const now = new Date();
    const hasActivePlan =
      status === 'active' ||
      (status === 'trialing' && trialEnd && now < trialEnd);

    if (hasActivePlan) {
      redirect(`/${locale}/dashboard`);
    }
  }

  return <>{children}</>;
}
