import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StripePortalButton } from '@/components/dashboard/stripe-portal-button';

/** Valeur API Stripe Customer Portal (hors copy utilisateur). */
const STRIPE_PORTAL_FLOW_UPGRADE = 'upgrade' as const;

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardUpgradePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Dashboard.upgradePage' });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single();

  const status = profile?.subscription_status;
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialing = status === 'trialing' && trialEnd && new Date() < trialEnd;
  if (isTrialing) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-10 max-w-[600px] mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-zinc-100">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          {t('subtitle')}
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-300 mt-2 font-medium">
          {t('volumeHint')}
        </p>
      </div>
      <StripePortalButton locale={locale} flow={STRIPE_PORTAL_FLOW_UPGRADE}>
        {t('cta')}
      </StripePortalButton>
    </div>
  );
}
