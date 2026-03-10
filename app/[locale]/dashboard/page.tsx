import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { Info, Star as StarIconSmall, ThumbsUp, AlertTriangle } from 'lucide-react';
import { DashboardReviewsSection } from '@/components/dashboard/dashboard-reviews-section';
import { StatsCard } from '@/components/dashboard/stats-card';
import { OverviewChart } from '@/components/dashboard/overview-chart';
import { PlatformDistributionChart } from '@/components/dashboard/platform-distribution-chart';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string; q?: string }>;
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
  const { welcome, q } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Dashboard.overview');
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();

  let reviews: ReviewDisplay[] = [];
  let totalReviews = 0;
  let avgRating = 0;
  let securityAlerts = 0;
  let establishmentName = 'Mon établissement';

  if (supabaseUser) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('establishment_name')
      .eq('id', supabaseUser.id)
      .single();
    if (profile?.establishment_name) establishmentName = profile.establishment_name;

    const { data: supabaseReviews } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, source, response_text, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
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
  } else {
    const [prismaReviews, statsData, securityAlertsCount] = await Promise.all([
      prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.review.aggregate({
        _count: { id: true },
        _avg: { rating: true },
      }),
      prisma.review.count({ where: { rating: { lt: 3 } } }),
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
    totalReviews = statsData._count.id;
    avgRating = statsData._avg.rating ?? 0;
    securityAlerts = securityAlertsCount;
  }

  const positiveCount = reviews.filter((r) => r.rating >= 4).length;
  const negativeCount = reviews.filter((r) => r.rating <= 3).length;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      {welcome === '1' && (
        <div className="rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 dark:border-emerald-500/20 p-4 text-emerald-800 dark:text-emerald-200">
          <p className="font-medium">Bienvenue ! Votre essai gratuit de 14 jours a bien été activé.</p>
          <p className="mt-1 text-sm opacity-90 dark:text-emerald-200/90">Aucun débit aujourd&apos;hui. Explorez toutes les fonctionnalités.</p>
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
              {totalReviews > 0 && (
                <span className="inline-flex items-center rounded-full bg-emerald-400/15 text-emerald-100 border border-emerald-300/60 px-2 py-0.5 text-[10px] font-semibold">
                  +8% vs mois dernier
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/70">Objectif : maintenir &gt; 4.5</p>
          </div>
        </StatsCard>

        {/* Total avis */}
        <StatsCard className="rounded-2xl bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800/50 shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-zinc-700 p-4 sm:p-5 transition-all duration-300 ease-in-out">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/15 flex items-center justify-center">
              <StarIconSmall className="w-4 h-4 text-sky-600" />
            </div>
            {totalReviews > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                +12%
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
            {totalReviews > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                +5%
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
            {totalReviews > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                -2%
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
          <OverviewChart reviews={reviews} locale={locale} />
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
