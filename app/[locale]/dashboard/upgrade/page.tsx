import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { UpgradePlansGrid } from '@/components/dashboard/upgrade-plans-grid';

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
    .select('subscription_plan, selected_plan, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single();

  const selectedPlanSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? undefined);
  const status = profile?.subscription_status ?? null;
  const trialEnd = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const now = new Date();
  const isTrialing = status === 'trialing' && trialEnd && now < trialEnd;
  const hasActiveSubscription = status === 'active' || status === 'past_due';

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-10 max-w-[1200px] mx-auto">
      <div className="mb-10">
        <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 dark:text-zinc-100">
          Changer de plan
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
          {(hasActiveSubscription || isTrialing)
            ? 'Le prorata est calculé automatiquement par Stripe. Vous payez uniquement la différence.'
            : 'Choisissez votre plan et activez 14 jours gratuits.'}
        </p>
      </div>

      <UpgradePlansGrid
        currentPlanSlug={selectedPlanSlug}
        isTrialing={!!isTrialing}
        hasActiveSubscription={!!hasActiveSubscription}
        locale={locale}
      />
    </div>
  );
}
