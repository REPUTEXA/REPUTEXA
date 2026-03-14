import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import { getRemainingTrialDays, formatTrialEndDate } from '@/lib/trial-utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardLoadingFallback } from '@/components/dashboard/dashboard-loading-fallback';
import { StripeSyncOnReturn } from '@/components/dashboard/stripe-sync-on-return';
import { SyncLocationFromUrl } from '@/components/dashboard/sync-location-from-url';
import { ActiveLocationProvider } from '@/lib/active-location-context';

export const dynamic = 'force-dynamic';

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

  const PLAN_DISPLAY: Record<string, string> = {
    starter: 'Vision',
    manager: 'Pulse',
    Dominator: 'ZENITH',
    vision: 'Vision',
    pulse: 'Pulse',
    zenith: 'ZENITH',
    free: 'Vision',
  };

  let user: { id: string } | null = null;
  let establishmentName = 'Mon établissement';
  let fullName = '';
  let avatarUrl: string | null = null;
  let trialDaysLeft: number | null = null;
  let trialEndDate: string | null = null;
  let showPaywall = false;
  let showTrialBanner = false;
  let planDisplayName = 'Pulse';
  let selectedPlanSlug: 'vision' | 'pulse' | 'zenith' | 'free' = 'pulse';
  let isTrialing = false;
  let hasActiveSubscription = false;

  try {
    const supabase = await createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;

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

      const status = profile.subscription_status;
      const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const now = new Date();
      const trialInFuture = trialEnd && now < trialEnd;

      // Accès si trialing, active ou past_due (paiement échoué = période de grâce).
      hasActiveSubscription = status === 'active' || status === 'past_due';
      isTrialing = status === 'trialing' && !!trialInFuture;

      if (status !== 'trialing' && status !== 'active' && status !== 'past_due') {
        showPaywall = true;
      } else if (status === 'trialing' && trialEnd && now >= trialEnd) {
        showPaywall = true;
      } else if (isTrialing && trialEnd) {
        trialDaysLeft = getRemainingTrialDays(trialEnd);
        trialEndDate = formatTrialEndDate(trialEnd, locale);
        showTrialBanner = true;
      }
    }
  }
  } catch (e) {
    console.error('[dashboard layout]', e);
  }

  const isCriticalPhase = trialDaysLeft !== null && trialDaysLeft <= 2;

  if (showPaywall) {
    redirect(`/${locale}/upgrade`);
  }

  return (
    <ActiveLocationProvider
      establishmentName={establishmentName}
      selectedPlanSlug={selectedPlanSlug}
    >
      <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardShell
        establishmentName={establishmentName}
        fullName={fullName}
        avatarUrl={avatarUrl}
        trialDaysLeft={trialDaysLeft}
        trialEndDate={trialEndDate}
        showTrialBanner={showTrialBanner}
        planDisplayName={planDisplayName}
        selectedPlanSlug={selectedPlanSlug}
        isCriticalPhase={isCriticalPhase}
        showPaywall={showPaywall}
        isTrialing={isTrialing}
        hasActiveSubscription={hasActiveSubscription}
        locale={locale}
      >
        <Suspense fallback={null}>
          <StripeSyncOnReturn />
          <SyncLocationFromUrl />
        </Suspense>
        {children}
      </DashboardShell>
      </Suspense>
    </ActiveLocationProvider>
  );
}
