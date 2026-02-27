import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/navigation';
import {
  Star,
  MessageSquare,
  ShieldAlert,
  Clock,
  Sparkles,
  TrendingUp,
  Info,
  Check,
} from 'lucide-react';
import { StarRating } from '@/components/dashboard/star-rating';
import { SimulateReviewForm } from '@/components/dashboard/simulate-review-form';
import { GenerateResponseButton } from '@/components/dashboard/generate-response-button';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ welcome?: string }>;
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { welcome } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('Dashboard.overview');
  const tProspects = await getTranslations('Dashboard.prospects');

  const [reviews, statsData, securityAlertsCount, prospects] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.review.aggregate({
      _count: { id: true },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { rating: { lt: 3 } } }),
    prisma.prospect.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const totalReviews = statsData._count.id;
  const avgRating = statsData._avg.rating ?? 0;
  const securityAlerts = securityAlertsCount;
  const timeSavedMin = totalReviews * 5;

  const stats = [
    {
      label: t('stats.avgRating'),
      value: avgRating > 0 ? avgRating.toFixed(1) : '—',
      suffix: '/5',
      icon: Star,
      highlight: true,
      change: '+8%',
    },
    {
      label: t('stats.reviewsProcessed'),
      value: totalReviews,
      suffix: '',
      icon: MessageSquare,
      highlight: false,
      change: null,
    },
    {
      label: t('stats.securityAlerts'),
      value: securityAlerts,
      suffix: '',
      icon: ShieldAlert,
      highlight: false,
      change: securityAlerts > 0 ? '-2%' : null,
    },
    {
      label: t('stats.timeSaved'),
      value: timeSavedMin,
      suffix: ' min',
      icon: Clock,
      highlight: false,
      change: null,
    },
  ];

  return (
    <div className="p-6">
      {welcome === '1' && (
        <div className="mb-6 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200">
          <p className="font-medium">
            Bienvenue ! Votre essai gratuit de 14 jours a bien été activé.
          </p>
          <p className="mt-1 text-sm opacity-90">
            Aucun débit aujourd&apos;hui. Explorez toutes les fonctionnalités.
          </p>
        </div>
      )}
      {/* Titre & date */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}{' '}
          - La Bella Vista
        </p>
      </div>

      {/* Bandeau alerte */}
      {securityAlerts > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-5 w-5 flex-shrink-0 text-blue-500" />
          <p className="text-sm text-blue-900">
            L&apos;IA a détecté {securityAlerts} nouvel(s) avis négatif(s) cette
            semaine.
          </p>
          <Link
            href="/dashboard"
            className="ml-auto text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Voir les réponses →
          </Link>
        </div>
      )}

      {/* Stats cards */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl p-6 ${
              stat.highlight
                ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                : 'border border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <stat.icon
                className={`h-6 w-6 ${stat.highlight ? 'text-white' : 'text-blue-500'}`}
              />
              {stat.change && (
                <span
                  className={`text-xs font-medium ${
                    stat.change.startsWith('+')
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                >
                  {stat.change}
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-2xl font-bold ${
                stat.highlight ? 'text-white' : 'text-zinc-900'
              }`}
            >
              {stat.value}
              {stat.suffix}
            </p>
            <p
              className={`text-sm ${stat.highlight ? 'text-blue-100' : 'text-zinc-500'}`}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Graphique évolution - placeholder */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">
              Évolution de la note
            </h2>
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <TrendingUp className="h-4 w-4" />
              +0.8 pts
            </span>
          </div>
          <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50">
            <p className="text-sm text-zinc-400">Graphique à venir</p>
          </div>
        </div>

        {/* Prospects */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-900">Prospects Sniper</h2>
            <Link
              href="/dashboard/prospects"
              className="text-sm font-medium text-blue-500 hover:text-blue-600"
            >
              Voir tout
            </Link>
          </div>
          {prospects.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              {tProspects('empty')}
            </p>
          ) : (
            <div className="space-y-3">
              {prospects.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {p.establishmentName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {p.city} • {p.rating}/5
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/prospects`}
                    className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {tProspects('generatePitch')}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Derniers avis */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900">{t('reviewsTitle')}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white"
            >
              Tous
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-gray-50"
            >
              Non répondus
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-gray-50"
            >
              Négatifs
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.length === 0 ? (
            <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-zinc-500">{t('reviewsEmpty')}</p>
            </div>
          ) : (
            reviews.slice(0, 6).map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-medium text-white">
                    {review.establishmentName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900">
                        {review.establishmentName}
                      </p>
                      <StarRating rating={review.rating} />
                    </div>
                    <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Google
                    </span>
                    <p className="mt-2 text-sm text-zinc-600">
                      {review.reviewText}
                    </p>
                    {review.responseText ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                        <Check className="h-4 w-4" />
                        Réponse envoyée
                      </p>
                    ) : (
                      <div className="mt-2">
                        <GenerateResponseButton reviewId={review.id} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Simulate form */}
      <section className="mt-8">
        <h2 className="mb-3 font-semibold text-zinc-900">{t('simulateTitle')}</h2>
        <SimulateReviewForm />
      </section>
    </div>
  );
}
