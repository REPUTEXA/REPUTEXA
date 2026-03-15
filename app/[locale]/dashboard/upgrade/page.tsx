import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StripePortalButton } from '@/components/dashboard/stripe-portal-button';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardUpgradePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

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
          Changer de plan
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          Gérez votre abonnement, changez de plan ou de quantité d&apos;établissements sur le portail sécurisé Stripe. Le prorata est calculé automatiquement.
        </p>
        <p className="text-sm text-slate-600 dark:text-zinc-300 mt-2 font-medium">
          Augmentez simplement la quantité sur votre plan actuel pour profiter de la réduction automatique (2<sup>e</sup> site -20%, 3<sup>e</sup> -30%, 4<sup>e</sup> -40%, 5<sup>e</sup> et + -50%).
        </p>
      </div>
      <StripePortalButton locale={locale} flow="upgrade">
        Ouvrir le portail de facturation
      </StripePortalButton>
    </div>
  );
}
