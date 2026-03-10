'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useMemo } from 'react';
import { Link } from '@/i18n/navigation';
import {
  Info,
  Star,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Calendar,
  ChevronDown,
} from 'lucide-react';

type FilterType = 'all' | 'unanswered' | 'negative';
type PlatformFilter = 'all' | 'google' | 'tripadvisor';
type ChartRange = '7j' | '30j' | '6m' | 'all' | 'perso';

type MockReview = {
  id: string;
  name: string;
  comment: string;
  rating: number;
  source: string;
  hasResponse: boolean;
};

const MOCK_REVIEWS: MockReview[] = [
  {
    id: '1',
    name: 'Tom',
    comment: 'Service impeccable, pizzas délicieuses. L\'équipe est aux petits soins. Je recommande vivement !',
    rating: 5,
    source: 'Google',
    hasResponse: true,
  },
  {
    id: '2',
    name: 'Robert',
    comment: 'Très déçu du temps d\'attente, 45 min pour une salade. La qualité ne compense pas.',
    rating: 2,
    source: 'Google',
    hasResponse: false,
  },
  {
    id: '3',
    name: 'Sophie',
    comment: 'Cadre charmant, desserts maison excellents. Petit bémol sur le service un peu lent le samedi.',
    rating: 4,
    source: 'TripAdvisor',
    hasResponse: true,
  },
  {
    id: '4',
    name: 'Marc',
    comment: 'Commande livrée froide, pizza pas cuite au centre. Très déçu pour le prix.',
    rating: 1,
    source: 'Google',
    hasResponse: false,
  },
  {
    id: '5',
    name: 'Claire',
    comment: 'Décoration soignée, ambiance cosy. Les pâtes fraîches sont un régal. À refaire !',
    rating: 5,
    source: 'TripAdvisor',
    hasResponse: true,
  },
  {
    id: '6',
    name: 'Philippe',
    comment: 'Correct sans plus. Le rapport qualité-prix est moyen pour la région.',
    rating: 3,
    source: 'Google',
    hasResponse: false,
  },
];

const CHART_DATA: Record<ChartRange, number[]> = {
  '7j': [3.2, 2.9, 3.5, 3.1, 2.7, 2.8, 3.0],
  '30j': [2.8, 3.1, 2.9, 3.3, 3.0, 2.7, 2.9, 3.2, 3.1, 2.8],
  '6m': [3.2, 2.9, 3.5, 3.1, 2.7, 2.8, 3.0, 3.2, 2.9, 3.4, 3.0, 2.7],
  all: [2.8, 3.2, 2.9, 3.1, 3.0, 2.7, 2.9, 3.3],
  perso: [2.9, 3.1, 2.8, 3.2, 3.0],
};

export function LandingDashboardMockup() {
  const t = useTranslations('LandingMockup');
  const locale = useLocale();
  const localeMap: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
  };
  const platformLabels: Record<PlatformFilter, string> = {
    all: t('platformsAll'),
    google: 'Google',
    tripadvisor: 'TripAdvisor',
  };
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [platform, setPlatform] = useState<PlatformFilter>('all');
  const [chartRange, setChartRange] = useState<ChartRange>('6m');
  const [platformOpen, setPlatformOpen] = useState(false);

  const today = new Date();
  const dateStr = today.toLocaleDateString(localeMap[locale] ?? 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const filteredReviews = useMemo(() => {
    let list = MOCK_REVIEWS;
    if (filter === 'unanswered') {
      list = list.filter((r) => !r.hasResponse);
    } else if (filter === 'negative') {
      list = list.filter((r) => r.rating < 4);
    }
    if (platform !== 'all') {
      list = list.filter((r) =>
        r.source.toLowerCase().includes(platform)
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.comment.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, filter, platform]);

  const chartValues = CHART_DATA[chartRange];
  const positiveCount = MOCK_REVIEWS.filter((r) => r.rating >= 4).length;
  const negativeCount = MOCK_REVIEWS.filter((r) => r.rating < 4).length;

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
              <span className="text-[10px] sm:text-xs text-slate-600 font-medium truncate">
                app.reputexa.ai/dashboard
              </span>
            </div>
          </div>
        </div>

        {/* Contenu du dashboard */}
        <div className="p-3 sm:p-4 md:p-5 bg-white space-y-3 sm:space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Header */}
          <div>
            <h1 className="font-display font-bold text-lg sm:text-xl text-slate-900">
              {t('overview')}
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 capitalize">
              {dateStr} · La bella
            </p>
          </div>

          {/* Bandeau alerte IA */}
          <Link
            href="/signup"
            className="flex items-center gap-2 sm:gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 hover:bg-sky-100/80 transition-colors"
          >
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-900">
                {t('aiDetected', { count: 2 })}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Des réponses personnalisées ont été préparées et sont prêtes à envoyer.
              </p>
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-sky-600 hover:text-sky-700 whitespace-nowrap shrink-0">
              {t('seeResponses')}
            </span>
          </Link>

          {/* Cartes de stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white p-3 sm:p-4 min-w-0">
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/15 flex items-center justify-center">
                    <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-white/70">{t('avgRating')}</p>
                    <p className="text-base sm:text-lg font-display font-bold leading-tight">
                      2.7<span className="text-sm font-medium">/5</span>
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-400/15 text-emerald-100 border border-emerald-300/60 px-1.5 py-0.5 text-[9px] font-semibold">
                  +8%
                </span>
              </div>
              <p className="text-[9px] text-white/70">{t('objective')}</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0 shadow-[4px_6px_0_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-sky-50 flex items-center justify-center">
                  <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                  +12%
                </span>
              </div>
              <p className="text-base sm:text-lg font-display font-bold text-slate-900">6</p>
              <p className="text-[10px] font-medium text-slate-500">{t('reviewsThisMonth')}</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0 shadow-[4px_6px_0_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <ThumbsUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                  +12%
                </span>
              </div>
              <p className="text-base sm:text-lg font-display font-bold text-slate-900">{positiveCount}</p>
              <p className="text-[10px] font-medium text-slate-500">{t('positiveReviews')}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{t('totalPeriod')}</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 min-w-0 shadow-[4px_6px_0_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between mb-1.5">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600" />
                </div>
                <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                  -2%
                </span>
              </div>
              <p className="text-base sm:text-lg font-display font-bold text-slate-900">{negativeCount}</p>
              <p className="text-[10px] font-medium text-slate-500">Avis négatifs (1★ à 3★)</p>
              <p className="text-[9px] text-slate-400 mt-0.5">Total sur la période affichée</p>
            </div>
          </section>

          {/* Graphiques */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[4px_6px_0_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  {t('noteEvolution')}
                </h3>
                <p className="text-[10px] text-slate-500">
                  Période : {chartRange === 'all' ? 'Tout' : chartRange === 'perso' ? 'Personnalisée' : chartRange}
                </p>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(['7j', '30j', '6m', 'all', 'perso'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setChartRange(range)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      chartRange === range
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {range === 'all' ? 'Tout' : range === 'perso' ? (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> Perso
                      </span>
                    ) : (
                      range
                    )}
                  </button>
                ))}
              </div>
              <div className="h-16 sm:h-20 flex items-end gap-0.5 px-1">
                {chartValues.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-sky-500/80 min-h-[8px] transition-all duration-300"
                    style={{ height: `${(v / 5) * 100}%` }}
                  />
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-1">mars 2026</p>
            </div>

            <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-[4px_6px_0_rgba(0,0,0,0.04)]">
              <h3 className="font-display font-semibold text-sm text-slate-900 mb-0.5">
                {t('reviewsByPlatform')}
              </h3>
              <p className="text-[10px] text-slate-500 mb-2">{t('distribution')}</p>
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 15 * 0.67} ${2 * Math.PI * 15}`}
                      strokeLinecap="round"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 15 * 0.33} ${2 * Math.PI * 15}`}
                      strokeDashoffset={-2 * Math.PI * 15 * 0.67}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span className="text-[10px] font-medium text-slate-700">Google 67%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span className="text-[10px] font-medium text-slate-700">TripAdvisor 33%</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Derniers avis - interactif */}
          <div>
            <h2 className="font-display font-bold text-sm text-slate-900 mb-2">
              Derniers avis
            </h2>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <input
                type="search"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-[10px] sm:text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 max-w-[140px] transition-all"
              />
              <div className="flex gap-1">
                {(['all', 'unanswered', 'negative'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                      filter === f
                        ? 'bg-sky-500 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {f === 'all' ? 'Tous' : f === 'unanswered' ? 'Non répondus' : 'Négatifs'}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPlatformOpen(!platformOpen)}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[10px] text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-all"
                >
                  {platformLabels[platform]}
                  <ChevronDown className={`w-2.5 h-2.5 transition-transform ${platformOpen ? 'rotate-180' : ''}`} />
                </button>
                {platformOpen && (
                  <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-slate-200 bg-white shadow-lg z-10 min-w-[120px]">
                    {(['all', 'google', 'tripadvisor'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setPlatform(p);
                          setPlatformOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-[10px] font-medium transition-colors ${
                          platform === p ? 'bg-sky-50 text-sky-600' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {platformLabels[p]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredReviews.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-xs text-slate-500">
                    Aucun avis ne correspond aux filtres.
                  </p>
                </div>
              ) : (
                filteredReviews.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-[4px_6px_0_rgba(0,0,0,0.04)] hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white font-semibold text-xs">
                          {r.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{r.name}</p>
                          <div className="flex gap-0.5 items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                                }`}
                              />
                            ))}
                            {r.hasResponse && (
                              <span className="ml-1 text-[9px] text-emerald-600 font-medium">✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] text-slate-400">
                        {r.rating >= 4 ? 'il y a 2j' : 'il y a 1j'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border bg-sky-50 text-sky-600 border-sky-100">
                        {r.source}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed line-clamp-2">{r.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
