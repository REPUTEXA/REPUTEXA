import { setRequestLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { Info, Star as StarIconSmall, ThumbsUp, AlertTriangle } from 'lucide-react';
import { DashboardReviewsSection } from '@/components/dashboard/dashboard-reviews-section';
import { StatsCard } from '@/components/dashboard/stats-card';
import { RatingEvolutionChart } from '@/components/dashboard/rating-evolution-chart';
import { PlatformDistributionChart } from '@/components/dashboard/platform-distribution-chart';
import { WhatsAppShareButton } from '@/components/share/whatsapp-share-button';
import { DashboardDateRangePicker } from '@/components/dashboard/dashboard-date-range-picker';
import { SuccessPaymentToast } from '@/components/dashboard/success-payment-toast';
import { SubscriptionSuccessEffects } from '@/components/dashboard/subscription-success-effects';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string; status?: string; plan?: string; q?: string; from?: string; to?: string; period?: string }>;
};

export const dynamic = 'force-dynamic';

type ReviewDisplay = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  source: string;
  responseText?: string | null;
  createdAt: string;
};

export default async function DashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { welcome, status, plan, q, from, to, period } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Dashboard.overview');
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  let reviews: ReviewDisplay[] = [];
  let totalReviews = 0;
  let avgRating = 0;
  let securityAlerts = 0;
  let establishmentName = 'Mon établissement';

  const today = startOfDay(new Date());
  const defaultFrom = startOfDay(subMonths(today, 1));

  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (from && to) {
    const parsedFrom = new Date(from);
    const parsedTo = new Date(to);
    if (!Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime())) {
      fromDate = startOfDay(parsedFrom);
      toDate = endOfDay(parsedTo);
    }
  }

  if (!fromDate || !toDate) {
    if (period === '7d') {
      fromDate = startOfDay(subDays(today, 6));
      toDate = endOfDay(today);
    } else if (period === '30d') {
      fromDate = startOfDay(subDays(today, 29));
      toDate = endOfDay(today);
    } else if (period === '3m') {
      fromDate = startOfDay(subMonths(today, 3));
      toDate = endOfDay(today);
    } else if (period === '12m') {
      fromDate = startOfDay(subMonths(today, 12));
      toDate = endOfDay(today);
    } else {
      fromDate = defaultFrom;
      toDate = endOfDay(today);
    }
  }

  const currentFromIso = fromDate.toISOString();
  const currentToIso = toDate.toISOString();

  const diffMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - diffMs);
  const prevFromIso = prevFrom.toISOString();
  const prevToIso = prevTo.toISOString();

  let prevTotalReviews = 0;
  let prevAvgRating = 0;
  let prevPositiveCount = 0;
  let prevNegativeCount = 0;

  if (supabaseUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name')
      .eq('id', supabaseUser.id)
      .single();
    if (profile?.establishment_name) establishmentName = profile.establishment_name;

    const activeLocationId = (await cookies()).get('reputexa_active_location')?.value ?? null;
    let reviewsQuery = supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, response_text, created_at')
      .eq('user_id', supabaseUser.id)
      .gte('created_at', currentFromIso)
      .lte('created_at', currentToIso);
    if (activeLocationId === 'profile') {
      reviewsQuery = reviewsQuery.is('establishment_id', null);
    } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
      reviewsQuery = reviewsQuery.eq('establishment_id', activeLocationId);
    }
    const { data: supabaseReviews } = await reviewsQuery.order('created_at', { ascending: false });
    reviews = (supabaseReviews ?? []).map((r) => {
      const safeRating = typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0;
      const created =
        typeof r.created_at === 'string' && r.created_at
          ? r.created_at
          : new Date().toISOString();
      return {
        id: String(r.id),
        reviewerName: String(r.reviewer_name ?? 'Client'),
        rating: safeRating,
        comment: String(r.comment ?? ''),
        source: String(r.source ?? 'Unknown'),
        responseText: r.response_text ?? null,
        createdAt: created,
      };
    });
    totalReviews = reviews.length;
    avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    securityAlerts = reviews.filter((r) => r.rating < 3).length;

    let prevReviewsQuery = supabase
      .from('reviews')
      .select('id, rating, created_at')
      .eq('user_id', supabaseUser.id)
      .gte('created_at', prevFromIso)
      .lte('created_at', prevToIso);
    if (activeLocationId === 'profile') {
      prevReviewsQuery = prevReviewsQuery.is('establishment_id', null);
    } else if (activeLocationId && /^[0-9a-f-]{36}$/i.test(activeLocationId)) {
      prevReviewsQuery = prevReviewsQuery.eq('establishment_id', activeLocationId);
    }
    const { data: prevReviewsRaw } = await prevReviewsQuery;

    const prevReviews = (prevReviewsRaw ?? []).map((r) => {
      const safeRating =
        typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0;
      return { rating: safeRating, createdAt: String(r.created_at ?? '') };
    });

    prevTotalReviews = prevReviews.length;
    prevAvgRating = prevReviews.length
      ? prevReviews.reduce((s, r) => s + r.rating, 0) / prevReviews.length
      : 0;
    prevPositiveCount = prevReviews.filter((r) => r.rating >= 4).length;
    prevNegativeCount = prevReviews.filter((r) => r.rating <= 3).length;
  } else {
    const [prismaReviews, prevPrismaReviews] = await Promise.all([
      prisma.review.findMany({
        where: { createdAt: { gte: fromDate, lte: toDate } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.findMany({
        where: { createdAt: { gte: prevFrom, lte: prevTo } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    reviews = prismaReviews.map((r) => {
      const safeRating = typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0;
      const created =
        r.createdAt instanceof Date && !Number.isNaN(r.createdAt.getTime())
          ? r.createdAt.toISOString()
          : new Date().toISOString();
      return {
        id: String(r.id),
        reviewerName: String(r.establishmentName ?? 'Client'),
        rating: safeRating,
        comment: String(r.reviewText ?? ''),
        source: 'Google',
        responseText: r.responseText ?? null,
        createdAt: created,
      };
    });
    totalReviews = reviews.length;
    avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    securityAlerts = reviews.filter((r) => r.rating < 3).length;

    prevTotalReviews = prevPrismaReviews.length;
    prevAvgRating = prevPrismaReviews.length
      ? prevPrismaReviews.reduce(
          (s, r) =>
            s +
            (typeof r.rating === 'number' && Number.isFinite(r.rating) ? r.rating : 0),
          0,
        ) / prevPrismaReviews.length
      : 0;
    prevPositiveCount = prevPrismaReviews.filter(
      (r) => typeof r.rating === 'number' && r.rating >= 4,
    ).length;
    prevNegativeCount = prevPrismaReviews.filter(
      (r) => typeof r.rating === 'number' && r.rating <= 3,
    ).length;
  }

  const positiveCount = reviews.filter((r) => r.rating >= 4).length;
  const negativeCount = reviews.filter((r) => r.rating <= 3).length;

  const computeDelta = (current: number, previous: number): number | null => {
    if (!previous || previous <= 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const avgRatingDelta = computeDelta(avgRating, prevAvgRating);
  const totalReviewsDelta = computeDelta(totalReviews, prevTotalReviews);
  const positiveDelta = computeDelta(positiveCount, prevPositiveCount);
  const negativeDelta = computeDelta(negativeCount, prevNegativeCount);

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 max-w-[1600px] mx-auto">
      <SuccessPaymentToast />
      <SubscriptionSuccessEffects />
      {(welcome === '1' || status === 'success' || status === 'trial_started') && (
        <div className="rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 dark:border-emerald-500/20 p-4 text-emerald-800 dark:text-emerald-200">
          <p className="font-medium">
            Bienvenue ! {plan
              ? `Votre abonnement ${plan === 'zenith' ? 'ZENITH' : plan.charAt(0).toUpperCase() + plan.slice(1)} a bien été activé.`
              : 'Votre essai gratuit de 14 jours a bien été activé.'}
          </p>
          <p className="mt-1 text-sm opacity-90 dark:text-emerald-200/90">Explorez toutes les fonctionnalités de votre plan.</p>
        </div>
      )}

      {/* Titre & date */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-zinc-100">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          {new Date().toLocaleDateString(
            locale === 'en' ? 'en-US' : 'fr-FR',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
          )}{' '}
          · {establishmentName}
        </p>
      </div>

      <DashboardDateRangePicker />

      {/* Contenu principal (stats + avis) */}
      {/* Bandeau alerte IA — masqué si 0 avis */}
      {totalReviews > 0 && (
      <div className="flex items-center gap-3 rounded-2xl border border-sky-100 dark:border-zinc-800/50 bg-sky-50 dark:bg-sky-950/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
            L&apos;IA a détecté{' '}
            <span className="text-sky-600 font-semibold">
              {securityAlerts} nouveaux avis négatifs
            </span>{' '}
            cette semaine
          </p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Des réponses personnalisées ont été préparées et sont prêtes à envoyer.
          </p>
        </div>
        <Link
          href="/dashboard/responses"
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap"
        >
          Voir les réponses →
        </Link>
      </div>
      )}

      {/* Cartes de statistiques: 1 col mobile, 2 tablette, 3 desktop */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Note moyenne (carte gradient) */}
        <StatsCard className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg dark:shadow-glow border border-transparent dark:border-zinc-800/50 hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-none dark:hover:border-zinc-700 transition-all duration-300 ease-in-out">
          <div className="p-4 sm:p-5 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                  <StarIconSmall className="w-4 h-4 text-yellow-300" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white/70">Note moyenne</p>
                  <p className="text-2xl font-display font-bold leading-tight">
                    {avgRating > 0 ? avgRating.toFixed(1) : '—'}
                    <span className="text-base font-medium">/5</span>
                  </p>
                </div>
              </div>
              {avgRatingDelta != null && (
                <span className="inline-flex items-center rounded-full bg-emerald-400/15 text-emerald-100 border border-emerald-300/60 px-2 py-0.5 text-[10px] font-semibold">
                  {avgRatingDelta >= 0 ? '+' : ''}
                  {avgRatingDelta.toFixed(0)}
                  % vs période précédente
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/70">Objectif : maintenir &gt; 4.5</p>
            {avgRating > 0 && (
              <WhatsAppShareButton
                rating={avgRating.toFixed(1)}
                className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/80 hover:text-white"
              />
            )}
          </div>
        </StatsCard>

        {/* Total avis */}
        <StatsCard className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-4 sm:p-5 transition-all duration-300 ease-in-out">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/15 flex items-center justify-center">
              <StarIconSmall className="w-4 h-4 text-sky-600" />
            </div>
            {totalReviewsDelta != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                {totalReviewsDelta >= 0 ? '+' : ''}
                {totalReviewsDelta.toFixed(0)}
                %
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-zinc-100">
            {totalReviews}
          </p>
          <p className="text-xs font-medium text-slate-500">Avis ce mois</p>
        </StatsCard>

        {/* Avis positifs */}
        <StatsCard className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-4 sm:p-5 transition-all duration-300 ease-in-out">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center">
              <ThumbsUp className="w-4 h-4 text-emerald-600" />
            </div>
            {positiveDelta != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                {positiveDelta >= 0 ? '+' : ''}
                {positiveDelta.toFixed(0)}
                %
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-zinc-100">
            {positiveCount}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Avis positifs (4★ et 5★)</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Total sur la période affichée</p>
        </StatsCard>

        {/* Avis négatifs */}
        <StatsCard className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-4 sm:p-5 transition-all duration-300 ease-in-out">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            {negativeDelta != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                {negativeDelta >= 0 ? '+' : ''}
                {negativeDelta.toFixed(0)}
                %
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-bold text-slate-900 dark:text-zinc-100">
            {negativeCount}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">Avis négatifs (1★ à 3★)</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">Total sur la période affichée</p>
        </StatsCard>
      </section>

      {/* Graphiques: 1 col mobile, 2 tablette, 3 desktop */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Évolution de la note */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-5 transition-all duration-300 ease-in-out">
          <RatingEvolutionChart reviews={reviews} locale={locale} />
        </div>

        {/* Avis par plateforme */}
        <div className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-5 transition-all duration-300 ease-in-out">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-slate-900 dark:text-zinc-100">
              Avis par plateforme
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Répartition totale</p>
          </div>
          <PlatformDistributionChart reviews={reviews} />
        </div>
      </section>

      {/* Derniers avis */}
      <DashboardReviewsSection
        reviews={reviews}
        useSupabaseAuth={!!supabaseUser}
        initialSearch={q ?? ''}
      />
    </div>
  );
}
