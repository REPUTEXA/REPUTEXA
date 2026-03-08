import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { Info, Star as StarIconSmall, Building2 } from 'lucide-react';
import { SimulateReviewForm } from '@/components/dashboard/simulate-review-form';
import { DashboardReviewsSection } from '@/components/dashboard/dashboard-reviews-section';

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
  let responseCount = 0;
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
      .select('id, reviewer_name, rating, comment, source, response_text')
      .order('created_at', { ascending: false })
      .limit(30);
    reviews = (supabaseReviews ?? []).map((r) => ({
      id: r.id,
      reviewerName: r.reviewer_name,
      rating: r.rating,
      comment: r.comment,
      source: r.source,
      responseText: r.response_text ?? null,
    }));
    responseCount = reviews.filter((r) => r.responseText).length;
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
    reviews = prismaReviews.map((r) => ({
      id: r.id,
      reviewerName: r.establishmentName,
      rating: r.rating,
      comment: r.reviewText,
      source: 'Google',
      responseText: r.responseText,
    }));
    totalReviews = statsData._count.id;
    avgRating = statsData._avg.rating ?? 0;
    responseCount = prismaReviews.filter((r) => r.responseText).length;
    securityAlerts = securityAlertsCount;
  }

  const responseRatePct = totalReviews > 0 ? Math.round((responseCount / totalReviews) * 100) : 0;
  const showEmptyState = supabaseUser && totalReviews === 0;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {welcome === '1' && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-emerald-200">
          <p className="font-medium">Bienvenue ! Votre essai gratuit de 14 jours a bien été activé.</p>
          <p className="mt-1 text-sm opacity-90">Aucun débit aujourd&apos;hui. Explorez toutes les fonctionnalités.</p>
        </div>
      )}

      {/* Titre & date */}
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString(
            locale === 'en' ? 'en-US' : 'fr-FR',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
          )}{' '}
          · {establishmentName}
        </p>
      </div>

      {/* Empty State : pas encore d'établissements/avis connectés */}
      {showEmptyState && (
        <>
          <div className="flex flex-col items-center justify-center py-16 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="font-display font-bold text-xl text-slate-900 mb-2">
              Aucun avis pour le moment
            </h2>
            <p className="text-slate-500 text-center max-w-md mb-6">
              Connectez votre premier établissement (Google, TripAdvisor) pour commencer à recevoir et gérer vos avis clients.
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              🚀 Configurer mon premier établissement
            </Link>
          </div>
          <section className="mt-6">
            <h2 className="font-display font-bold text-lg text-slate-900 mb-3">{t('simulateTitle')}</h2>
            <SimulateReviewForm />
          </section>
        </>
      )}

      {/* Contenu principal (stats + avis) — masqué si empty state */}
      {!showEmptyState && (
        <>
      {/* Bandeau alerte IA — masqué si 0 avis */}
      {totalReviews > 0 && (
      <div className="flex items-center gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <Info className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            L&apos;IA a détecté{' '}
            <span className="text-sky-600 font-semibold">
              {securityAlerts} nouveaux avis négatifs
            </span>{' '}
            cette semaine
          </p>
          <p className="text-xs text-slate-500">
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

      {/* Cartes de statistiques */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Note moyenne (carte gradient) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg">
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
              <span className="inline-flex items-center rounded-full bg-emerald-400/15 text-emerald-100 border border-emerald-300/60 px-2 py-0.5 text-[10px] font-semibold">
                +8% vs mois dernier
              </span>
            </div>
            <p className="text-[11px] text-white/70">Objectif : maintenir &gt; 4.5</p>
          </div>
        </div>

        {/* Total avis */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <StarIconSmall className="w-4 h-4 text-sky-600" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              +12%
            </span>
          </div>
          <p className="text-2xl font-display font-bold text-slate-900">
            {totalReviews}
          </p>
          <p className="text-xs font-medium text-slate-500">Avis ce mois</p>
        </div>

        {/* Taux de réponse */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4 text-emerald-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              +5%
            </span>
          </div>
          <p className="text-2xl font-display font-bold text-slate-900">{responseRatePct}%</p>
          <p className="text-xs font-medium text-slate-500">Taux de réponse</p>
          <p className="text-[11px] text-slate-400 mt-1">Objectif : 95%</p>
        </div>

        {/* Score sentiment */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="w-4 h-4 text-indigo-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 18V5" />
                <path d="M9 9H7a2 2 0 0 0-2 2v1" />
                <path d="M15 9h2a2 2 0 0 1 2 2v1" />
                <path d="M8 21h8" />
              </svg>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
              -2%
            </span>
          </div>
          <p className="text-2xl font-display font-bold text-slate-900">87/100</p>
          <p className="text-xs font-medium text-slate-500">Score sentiment</p>
          <p className="text-[11px] text-slate-400 mt-1">Légère baisse</p>
        </div>
      </section>

      {/* Graphiques */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Évolution de la note */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-slate-900">
                Évolution de la note
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">7 derniers mois</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full">
              <span>+0.8</span>
              <span className="text-emerald-400">pts</span>
            </div>
          </div>
          <div className="h-52">
            <svg viewBox="0 0 640 200" className="w-full h-full">
              <defs>
                <linearGradient id="ratingArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(215 90% 52%)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="hsl(215 90% 52%)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect
                x="60"
                y="10"
                width="560"
                height="160"
                fill="none"
                stroke="hsl(220 13% 90%)"
                strokeWidth="0"
              />
              {/* Grid lines */}
              {[0, 1, 2, 3].map((i) => (
                <line
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  x1="60"
                  x2="620"
                  y1={170 - i * 40}
                  y2={170 - i * 40}
                  stroke="hsl(220 13% 91%)"
                  strokeDasharray="3 3"
                />
              ))}
              {/* Area */}
              <path
                d="M60 150 C 120 146, 180 142, 240 138 C 300 134, 360 130, 420 122 C 480 114, 540 104, 600 96 L 600 170 L 60 170 Z"
                fill="url(#ratingArea)"
              />
              {/* Line */}
              <path
                d="M60 150 C 120 146, 180 142, 240 138 C 300 134, 360 130, 420 122 C 480 114, 540 104, 600 96"
                fill="none"
                stroke="hsl(215 90% 52%)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* X axis labels */}
              {['Août', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév'].map((m, idx) => {
                const x = 60 + idx * (560 / 6);
                return (
                  <text
                    key={m}
                    x={x}
                    y={190}
                    textAnchor="middle"
                    fontSize="11"
                    fill="hsl(220 9% 46%)"
                  >
                    {m}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Avis par plateforme */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-slate-900">
              Avis par plateforme
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Répartition totale</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="w-32 h-32 relative">
              <svg viewBox="0 0 120 120" className="w-full h-full">
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  stroke="#e5e7eb"
                  strokeWidth="14"
                  fill="none"
                />
                {/* Google */}
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  stroke="hsl(215 90% 52%)"
                  strokeWidth="14"
                  fill="none"
                  strokeDasharray="282.6"
                  strokeDashoffset="118"
                  strokeLinecap="round"
                />
                {/* TripAdvisor */}
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  stroke="hsl(175 80% 42%)"
                  strokeWidth="14"
                  fill="none"
                  strokeDasharray="282.6"
                  strokeDashoffset="206"
                  strokeLinecap="round"
                />
                {/* Yelp */}
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  stroke="hsl(0 72% 51%)"
                  strokeWidth="14"
                  fill="none"
                  strokeDasharray="282.6"
                  strokeDashoffset="244"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[hsl(215_90%_52%)]" />
                  <span className="text-xs font-medium text-slate-700">Google</span>
                </div>
                <span className="text-xs font-bold text-slate-900">58%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[hsl(175_80%_42%)]" />
                  <span className="text-xs font-medium text-slate-700">TripAdvisor</span>
                </div>
                <span className="text-xs font-bold text-slate-900">27%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[hsl(0_72%_51%)]" />
                  <span className="text-xs font-medium text-slate-700">Yelp</span>
                </div>
                <span className="text-xs font-bold text-slate-900">15%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Derniers avis */}
      <DashboardReviewsSection
        reviews={reviews}
        useSupabaseAuth={!!supabaseUser}
        initialSearch={q ?? ''}
      />

      {/* Simuler un avis */}
      <section className="mt-2">
        <h2 className="font-display font-bold text-lg text-slate-900 mb-3">
          {t('simulateTitle')}
        </h2>
        <SimulateReviewForm />
      </section>
        </>
      )}
    </div>
  );
}
