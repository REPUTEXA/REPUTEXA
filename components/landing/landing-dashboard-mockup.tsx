'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Info, Star as StarIconSmall, ThumbsUp, AlertTriangle } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';
import { DashboardDateRangePicker } from '@/components/dashboard/dashboard-date-range-picker';

const RatingEvolutionChart = dynamic(
  () =>
    import('@/components/dashboard/rating-evolution-chart').then((m) => ({
      default: m.RatingEvolutionChart,
    })),
  {
    loading: () => (
      <div className="h-[280px] w-full animate-pulse rounded-2xl bg-white/10" aria-hidden />
    ),
  },
);

const PlatformDistributionChart = dynamic(
  () =>
    import('@/components/dashboard/platform-distribution-chart').then((m) => ({
      default: m.PlatformDistributionChart,
    })),
  {
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-2xl bg-white/10" aria-hidden />
    ),
  },
);
import { DashboardReviewsSection } from '@/components/dashboard/dashboard-reviews-section';
import { WhatsAppShareButton } from '@/components/share/whatsapp-share-button';
import { getDemoReviews } from '@/lib/demo-dashboard-data';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { MERCHANT_TIMEZONE_FALLBACK } from '@/lib/datetime/merchant-timezone';

export function LandingDashboardMockup() {
  const locale = useLocale();
  const t = useTranslations('HomePage.dashboardMockup');
  const reviews = useMemo(() => getDemoReviews(), []);

  const totalReviews = reviews.length;
  const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / totalReviews;
  const positiveCount = reviews.filter((r) => r.rating >= 4).length;
  const negativeCount = reviews.filter((r) => r.rating <= 3).length;
  const securityAlerts = reviews.filter((r) => r.rating < 3).length;

  const avgRatingDelta = 8;
  const totalReviewsDelta = 12;
  const positiveDelta = 12;
  const negativeDelta = -2;

  const dateStr = new Date().toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/5 shadow-[0_24px_64px_rgba(15,23,42,0.85)] sm:shadow-[0_40px_120px_rgba(15,23,42,0.9)] p-1 sm:p-1.5 dashboard-glow min-w-0">
      <div className="rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden bg-white backdrop-blur-sm">
        {/* Barre navigateur */}
        <div className="bg-gradient-to-b from-slate-100 to-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-slate-200 min-w-0">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
          </div>
          <div className="flex-1 flex justify-center min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm max-w-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 shrink-0"
                aria-hidden
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="text-[10px] sm:text-xs text-slate-600 font-medium truncate">{t('browserUrl')}</span>
            </div>
          </div>
        </div>

        {/* Contenu = copie du dashboard réel */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 bg-white space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Titre & date */}
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-slate-900">{t('demoVenueName')}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 capitalize" suppressHydrationWarning>
              {t('dateLine', { date: dateStr })}
            </p>
          </div>

          <DashboardDateRangePicker />

          {/* Bandeau alerte IA */}
          {securityAlerts > 0 && (
            <Link
              href="/signup?mode=trial"
              className="flex items-center gap-2 sm:gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 hover:bg-sky-100/80 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <Info className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {t('aiAlertTitle', { count: securityAlerts })}
                </p>
                <p className="text-xs text-slate-500">{t('aiAlertSubtitle')}</p>
              </div>
              <span className="text-xs font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap shrink-0">
                {t('ctaViewReplies')}
              </span>
            </Link>
          )}

          {/* Cartes de statistiques — même structure que dashboard */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatsCard className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg border border-transparent p-4 sm:p-5">
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                      <StarIconSmall className="w-4 h-4 text-yellow-300" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/70">{t('avgRatingLabel')}</p>
                      <p className="text-2xl font-display font-bold leading-tight">
                        {avgRating.toFixed(1)}
                        <span className="text-base font-medium">/5</span>
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-400/15 text-emerald-100 border border-emerald-300/60 px-2 py-0.5 text-[10px] font-semibold">
                    +{avgRatingDelta}%
                  </span>
                </div>
                <p className="text-[11px] text-white/70">{t('avgRatingGoal')}</p>
                <WhatsAppShareButton
                  rating={avgRating.toFixed(1)}
                  className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/80 hover:text-white"
                />
              </div>
            </StatsCard>

            <StatsCard className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
                  <StarIconSmall className="w-4 h-4 text-sky-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  +{totalReviewsDelta}%
                </span>
              </div>
              <p className="text-2xl font-display font-bold text-slate-900">{totalReviews}</p>
              <p className="text-xs font-medium text-slate-500">{t('reviewsThisMonth')}</p>
            </StatsCard>

            <StatsCard className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  +{positiveDelta}%
                </span>
              </div>
              <p className="text-2xl font-display font-bold text-slate-900">{positiveCount}</p>
              <p className="text-xs font-medium text-slate-500">{t('positiveReviewsLabel')}</p>
              <p className="text-[11px] text-slate-400 mt-1">{t('totalOnPeriod')}</p>
            </StatsCard>

            <StatsCard className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                  {negativeDelta}%
                </span>
              </div>
              <p className="text-2xl font-display font-bold text-slate-900">{negativeCount}</p>
              <p className="text-xs font-medium text-slate-500">{t('negativeReviewsLabel')}</p>
              <p className="text-[11px] text-slate-400 mt-1">{t('totalOnPeriod')}</p>
            </StatsCard>
          </section>

          {/* Graphiques — mêmes composants */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <RatingEvolutionChart
                reviews={reviews}
                locale={locale}
                timeZone={MERCHANT_TIMEZONE_FALLBACK}
              />
            </div>
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
              <div className="mb-4">
                <h3 className="font-display font-semibold text-slate-900">{t('platformsTitle')}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t('platformsSubtitle')}</p>
              </div>
              <PlatformDistributionChart reviews={reviews} />
            </div>
          </section>

          {/* Derniers avis — même composant */}
          <DashboardReviewsSection
            reviews={reviews}
            useSupabaseAuth={false}
            intlLocaleTag={siteLocaleToIntlDateTag(locale)}
            timeZone={MERCHANT_TIMEZONE_FALLBACK}
          />
        </div>
      </div>
    </div>
  );
}
