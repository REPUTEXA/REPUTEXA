import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug, type PlanSlug } from '@/lib/feature-gate';
import { getRemainingTrialDays, formatTrialEndDate } from '@/lib/trial-utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import type { FeatureReleaseData } from '@/components/dashboard/feature-release-modal';
import { StripeSyncOnReturn } from '@/components/dashboard/stripe-sync-on-return';
import { SuccessEffectsWrapper } from '@/components/dashboard/success-effects-wrapper';
import { SyncLocationFromUrl } from '@/components/dashboard/sync-location-from-url';
import { ActiveLocationProvider } from '@/lib/active-location-context';
import { fetchCurrentPublishedLegal } from '@/lib/legal/current-published';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { merchantShouldSeeUpgrade } from '@/lib/subscription/merchant-paywall';
import { pickLocalizedString } from '@/lib/i18n/pick-localized-string';
import { resolveMerchantTimeZone } from '@/lib/datetime/merchant-timezone';
import { DashboardTimezoneProvider } from '@/components/dashboard/dashboard-timezone-provider';
import { SyncBrowserTimezone } from '@/components/dashboard/sync-browser-timezone';

export const dynamic = 'force-dynamic';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard.layout' });
  return { title: t('title') };
}

const LEGAL_DOC_TYPES = ['cgu', 'politique_confidentialite', 'mentions_legales'] as const;
type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

function isLegalDocType(v: string): v is LegalDocType {
  return (LEGAL_DOC_TYPES as readonly string[]).includes(v);
}

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tLegalDocs = await getTranslations({ locale, namespace: 'Legal.documentLabels' });
  const tBilling = await getTranslations({ locale, namespace: 'Billing' });
  const intlDateTag = siteLocaleToIntlDateTag(locale);

  /** Libellés d’offre — même normalisation que `toPlanSlug` (pas de repli arbitraire sur Pulse). */
  function planDisplayNameFromSlug(slug: PlanSlug): string {
    if (slug === 'free' || slug === 'vision') return tBilling('plans.vision');
    if (slug === 'pulse') return tBilling('plans.pulse');
    return tBilling('plans.zenith');
  }

  let user: { id: string } | null = null;
  let establishmentName = '';
  let fullName = '';
  let trialDaysLeft: number | null = null;
  let trialEndDate: string | null = null;
  let showPaywall = false;
  let showTrialBanner = false;
  let planDisplayName = tBilling('plans.vision');
  let selectedPlanSlug: PlanSlug = 'vision';
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
  let legalDocumentLabel = '';
  let isAdmin = false;
  let legalComplianceAccepted = false;
  let featureRelease: FeatureReleaseData | null = null;
  let profileTimezoneRaw: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user: u } } = await supabase.auth.getUser();
    user = u;

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('establishment_name, full_name, avatar_url, subscription_plan, trial_started_at, trial_ends_at, subscription_status, selected_plan, first_login, subscription_period_end, subscription_quantity, payment_status, last_legal_agreement_version, role, legal_compliance_accepted, last_seen_feature_release_id, timezone')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // Profil manquant ou erreur structure : on garde les valeurs par défaut, pas de log client
    }

    if (profile) {
      if ((profile as Record<string, unknown>).role === 'merchant_staff') {
        redirect(`/${locale}/staff`);
      }
      profileTimezoneRaw =
        typeof (profile as Record<string, unknown>).timezone === 'string'
          ? ((profile as Record<string, unknown>).timezone as string).trim() || null
          : null;
      establishmentName =
        typeof profile.establishment_name === 'string' && profile.establishment_name.trim()
          ? profile.establishment_name.trim()
          : '';
      fullName = profile.full_name || '';
      firstLogin = profile.first_login ?? true;
      isAdmin = (profile as Record<string, unknown>)?.role === 'admin';
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

      // Plan affiché : `subscription_plan` d’abord (palier réellement actif, ex. Zenith en essai) ;
      // `selected_plan` ne sert que de repli si la souscription n’est pas encore connue.
      {
        const sub = profile.subscription_plan as string | null;
        const sel = profile.selected_plan as string | null;
        const effectiveSlug = toPlanSlug(sub, sel);
        selectedPlanSlug = effectiveSlug;
        planDisplayName = planDisplayNameFromSlug(effectiveSlug);
      }

      hasUnpaidStatus = (profile.payment_status as string | null) === 'unpaid';

      showPaywall = merchantShouldSeeUpgrade({
        subscription_status: status,
        trial_ends_at: profile.trial_ends_at as string | null,
        trial_started_at: profile.trial_started_at as string | null,
        subscription_period_end: profile.subscription_period_end as string | null,
        role: (profile as Record<string, unknown>).role as string | null,
      });
      if (!showPaywall && isTrialing && trialEnd) {
        trialDaysLeft = getRemainingTrialDays(trialEnd);
        trialEndDate = formatTrialEndDate(trialEnd, locale);
        showTrialBanner = true;
      }
      showPastDueBanner = status === 'past_due' || hasUnpaidStatus;
      subscriptionQuantity = Math.max(1, (profile.subscription_quantity as number | null) ?? 1);
      legalComplianceAccepted =
        (profile as Record<string, unknown>).legal_compliance_accepted === true;
    }

    const [suggestionsRes, latestLegal, latestManualUpdateRes] = await Promise.all([
      supabase
        .from('app_suggestions')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'DONE')
        .not('completed_at', 'is', null)
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      fetchCurrentPublishedLegal(supabase),
      supabase
        .from('app_updates')
        .select('id, title, content, title_i18n, content_i18n, attachments, publish_at')
        .lte('publish_at', new Date().toISOString())
        .order('publish_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    updatesNewCount = suggestionsRes.count ?? 0;

    const lastSeenFr = (profile as Record<string, unknown> | null)?.last_seen_feature_release_id as string | null ?? null;
    const latestManual = latestManualUpdateRes.data;
    if (latestManual?.id && latestManual.id !== lastSeenFr) {
      const titleI18n = latestManual.title_i18n as Record<string, string> | null | undefined;
      const contentI18n = latestManual.content_i18n as Record<string, string> | null | undefined;
      const rawContent = (latestManual.content as string | null) ?? '';
      featureRelease = {
        id: latestManual.id,
        title: pickLocalizedString(titleI18n, locale, latestManual.title ?? ''),
        content: pickLocalizedString(contentI18n, locale, rawContent),
        attachments: latestManual.attachments,
        publishAt: String(latestManual.publish_at ?? latestManual.id),
      };
    }

    // — Consentement : version ACTIVE déjà en vigueur (date d’effet ≤ aujourd’hui UTC).
    // Avant le jour J : pas de modale ; après acceptation + router.refresh → aligné profil / admin.

    if (latestLegal) {
      currentLegalVersion = latestLegal.version;
      const userVersion = (profile as Record<string, unknown> | null)?.last_legal_agreement_version as number | null ?? 0;
      needsLegalConsent = currentLegalVersion > userVersion;
      if (needsLegalConsent) {
        legalSummary = latestLegal.summary_of_changes;
        legalEffectiveDate =
          latestLegal.effective_at != null && String(latestLegal.effective_at).trim()
            ? new Date(latestLegal.effective_at as string).toLocaleString(intlDateTag, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
                timeZoneName: 'short',
              })
            : latestLegal.effective_date
              ? new Date(latestLegal.effective_date).toLocaleDateString(intlDateTag, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })
              : '';
        const docType = String(latestLegal.document_type ?? '');
        legalDocumentLabel = isLegalDocType(docType) ? tLegalDocs(docType) : docType;
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

  const dashboardTimeZone = resolveMerchantTimeZone(profileTimezoneRaw);

  return (
    <ActiveLocationProvider
      establishmentName={establishmentName}
      selectedPlanSlug={selectedPlanSlug}
    >
      <DashboardTimezoneProvider initialTimeZone={dashboardTimeZone}>
      <Suspense fallback={null}>
      <DashboardShell
        firstLogin={firstLogin}
        establishmentName={establishmentName}
        fullName={fullName}
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
        legalDocumentLabel={legalDocumentLabel}
        isAdmin={isAdmin}
        needsLegalComplianceGate={!legalComplianceAccepted}
        featureRelease={featureRelease}
      >
        <Suspense fallback={null}>
          <StripeSyncOnReturn />
          <SyncLocationFromUrl />
          <SyncBrowserTimezone storedTimeZone={profileTimezoneRaw} />
          <SuccessEffectsWrapper />
        </Suspense>
        {children}
      </DashboardShell>
      </Suspense>
      </DashboardTimezoneProvider>
    </ActiveLocationProvider>
  );
}
