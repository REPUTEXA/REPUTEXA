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
import { SuccessEffectsWrapper } from '@/components/dashboard/success-effects-wrapper';
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
  let selectedPlanFromProfile: string | null = null;
  let isTrialing = false;
  let hasActiveSubscription = false;
  let showPastDueBanner = false;
  let hasUnpaidStatus = false;
  let firstLogin = true;
  let subscriptionQuantity = 1;
  let updatesNewCount = 0;
  let needsLegalConsent = false;
  let currentLegalVersion = 0;
  let legalSummary = '';
  let legalEffectiveDate = '';
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('establishment_name, full_name, avatar_url, subscription_plan, trial_started_at, trial_ends_at, subscription_status, selected_plan, first_login, subscription_period_end, subscription_quantity, payment_status, last_legal_agreement_version, role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Profil manquant ou erreur structure : on garde les valeurs par défaut, pas de log client
    }

    if (profile) {
      establishmentName = profile.establishment_name || establishmentName;
      fullName = profile.full_name || '';
      firstLogin = profile.first_login ?? true;
      avatarUrl = profile.avatar_url || null;
      planDisplayName = PLAN_DISPLAY[profile.subscription_plan] ?? 'Pulse';
      isAdmin = (profile as Record<string, unknown>)?.role === 'admin';
      // Accès aux fonctionnalités : basé uniquement sur la souscription Stripe actuelle (subscription_plan).
      // Pendant l'essai = Zénith complet ; selected_plan ne sert que pour le badge "Passage programmé" et le webhook.
      selectedPlanSlug = toPlanSlug(profile.subscription_plan, undefined);
      selectedPlanFromProfile = typeof profile.selected_plan === 'string' ? profile.selected_plan : null;

      const status = profile.subscription_status as string | null;
      const trialEnd = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const periodEnd = profile.subscription_period_end ? new Date(profile.subscription_period_end as string) : null;
      const now = new Date();
      const trialInFuture = trialEnd && now < trialEnd;
      const periodEndPassed = periodEnd && now >= periodEnd;

      // Accès si trialing, active ou past_due. Grace period : tant que subscription_period_end n'est pas passé.
      hasActiveSubscription = (status === 'active' || status === 'past_due') && !periodEndPassed;
      isTrialing = status === 'trialing' && !!trialInFuture;

      hasUnpaidStatus = (profile.payment_status as string | null) === 'unpaid';

      if (periodEndPassed) {
        showPaywall = true;
      } else if (status !== 'trialing' && status !== 'active' && status !== 'past_due') {
        showPaywall = true;
      } else if (status === 'trialing' && trialEnd && now >= trialEnd) {
        showPaywall = true;
      } else if (isTrialing && trialEnd) {
        trialDaysLeft = getRemainingTrialDays(trialEnd);
        trialEndDate = formatTrialEndDate(trialEnd, locale);
        showTrialBanner = true;
      }
      showPastDueBanner = status === 'past_due' || hasUnpaidStatus;
      subscriptionQuantity = Math.max(1, (profile.subscription_quantity as number | null) ?? 1);
    }

    const { count } = await supabase
      .from('app_suggestions')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'DONE')
      .not('completed_at', 'is', null)
      .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    updatesNewCount = count ?? 0;

    // — Vérification du consentement légal —
    const { data: latestLegal } = await supabase
      .from('legal_versioning')
      .select('version, summary_of_changes, effective_date')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestLegal) {
      currentLegalVersion = latestLegal.version;
      const userVersion = (profile as Record<string, unknown> | null)?.last_legal_agreement_version as number | null ?? 0;
      needsLegalConsent = currentLegalVersion > userVersion;
      if (needsLegalConsent) {
        legalSummary = latestLegal.summary_of_changes ?? '';
        legalEffectiveDate = latestLegal.effective_date
          ? new Date(latestLegal.effective_date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })
          : '';
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
        firstLogin={firstLogin}
        establishmentName={establishmentName}
        fullName={fullName}
        avatarUrl={avatarUrl}
        trialDaysLeft={trialDaysLeft}
        trialEndDate={trialEndDate}
        showTrialBanner={showTrialBanner}
        planDisplayName={planDisplayName}
        selectedPlanSlug={selectedPlanSlug}
        selectedPlanFromProfile={selectedPlanFromProfile}
        isCriticalPhase={isCriticalPhase}
        showPaywall={showPaywall}
        isTrialing={isTrialing}
        hasActiveSubscription={hasActiveSubscription}
        locale={locale}
        subscriptionQuantity={subscriptionQuantity}
        updatesNewCount={updatesNewCount}
        showPastDueBanner={showPastDueBanner}
        needsLegalConsent={needsLegalConsent}
        currentLegalVersion={currentLegalVersion}
        legalSummary={legalSummary}
        legalEffectiveDate={legalEffectiveDate}
        isAdmin={isAdmin}
      >
        <Suspense fallback={null}>
          <StripeSyncOnReturn />
          <SyncLocationFromUrl />
          <SuccessEffectsWrapper />
        </Suspense>
        {children}
      </DashboardShell>
      </Suspense>
    </ActiveLocationProvider>
  );
}
