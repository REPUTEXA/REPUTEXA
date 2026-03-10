import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StripeSyncOnReturn } from '@/components/dashboard/stripe-sync-on-return';

export const metadata: Metadata = {
  title: 'REPUTEXA - Dashboard',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const TRIAL_DAYS = 14;
  const PLAN_DISPLAY: Record<string, string> = {
    starter: 'Vision',
    manager: 'Pulse',
    Dominator: 'Zenith',
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let establishmentName = 'Mon établissement';
  let fullName = '';
  let avatarUrl: string | null = null;
  let hasDominatorPlan = false;
  let trialDaysLeft: number | null = null;
  let trialEndDate: string | null = null;
  let showPaywall = false;
  let showTrialBanner = false;
  let planDisplayName = 'Pulse';
  let selectedPlanSlug: 'vision' | 'pulse' | 'zenith' = 'pulse';

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('establishment_name, full_name, avatar_url, subscription_plan, trial_started_at, trial_ends_at, subscription_status, selected_plan')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Profil manquant ou erreur structure : on garde les valeurs par défaut, pas de log client
    }

    if (profile) {
      establishmentName = profile.establishment_name || establishmentName;
      fullName = profile.full_name || '';
      avatarUrl = profile.avatar_url || null;
      planDisplayName = PLAN_DISPLAY[profile.subscription_plan] ?? 'Pulse';
      selectedPlanSlug = toPlanSlug(profile.subscription_plan, profile.selected_plan ?? undefined);

      const trialEnd = profile.trial_ends_at
        ? new Date(profile.trial_ends_at)
        : profile.trial_started_at
          ? (() => { const d = new Date(profile.trial_started_at); d.setDate(d.getDate() + TRIAL_DAYS); return d; })()
          : null;
      const now = new Date();
      const trialInFuture = trialEnd && now < trialEnd;
      const hasActiveSubscription = profile.subscription_status === 'active';

      // Accès Zenith si trial_ends_at dans le futur OU abonnement actif
      hasDominatorPlan = !!(hasActiveSubscription || (trialInFuture && (profile.subscription_plan === 'Dominator' || profile.selected_plan === 'zenith')));

      // Redirection /upgrade : trial expiré ET pas d'abonnement actif (pas de stripe)
      if (profile.subscription_status === 'expired') {
        showPaywall = true;
      } else if (trialEnd && !hasActiveSubscription && now >= trialEnd) {
        showPaywall = true;
      } else if (trialInFuture) {
        trialDaysLeft = Math.max(0, Math.ceil((trialEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        trialEndDate = trialEnd!.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        showTrialBanner = true;
      }
    }
  }

  const isCriticalPhase = trialDaysLeft !== null && trialDaysLeft <= 2;

  if (showPaywall) {
    redirect(`/${locale}/upgrade`);
  }

  return (
    <DashboardShell
      establishmentName={establishmentName}
      fullName={fullName}
      avatarUrl={avatarUrl}
      hasDominatorPlan={hasDominatorPlan}
      trialDaysLeft={trialDaysLeft}
      trialEndDate={trialEndDate}
      showTrialBanner={showTrialBanner}
      planDisplayName={planDisplayName}
      selectedPlanSlug={selectedPlanSlug}
      isCriticalPhase={isCriticalPhase}
    >
      <Suspense fallback={null}>
        <StripeSyncOnReturn />
      </Suspense>
      {children}
    </DashboardShell>
  );
}
