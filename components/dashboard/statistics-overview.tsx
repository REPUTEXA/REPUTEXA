'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Sparkles, ArrowUpRight, Info, Clock, Send } from 'lucide-react';
import { RatingEvolutionChart } from '@/components/dashboard/rating-evolution-chart';
import type { PlanSlug } from '@/lib/feature-gate';
import { Skeleton } from '@/components/ui/skeleton';

type ReviewStat = {
  rating: number;
  comment: string;
  createdAt: string;
  source: string;
  responseText?: string | null;
};

type StatisticsOverviewProps = {
  reviews: ReviewStat[];
  locale: string;
  planSlug: PlanSlug;
};

function ReputationGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const strokeDashoffset = 283 - (283 * pct) / 100;
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgb(226 232 240)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="283"
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xl font-bold text-slate-800 dark:text-slate-100">
        {Math.round(pct)}
      </span>
    </div>
  );
}

function PaywallOverlay({
  children,
  locked,
  upgradeMessage,
  upgradeHref,
}: {
  children: React.ReactNode;
  locked: boolean;
  upgradeMessage: string;
  upgradeHref: string;
}) {
  const t = useTranslations('Statistics');
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="blur-sm select-none pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/60 dark:bg-slate-900/60 rounded-2xl">
        <p className="text-sm text-slate-600 dark:text-slate-300 text-center px-4">
          {upgradeMessage}
        </p>
        <Link
          href={upgradeHref}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
        >
          {t('upgrade')}
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

const cardClass =
  'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-5 min-w-0';

export function StatisticsOverview({
  reviews,
  locale,
  planSlug,
}: StatisticsOverviewProps) {
  const t = useTranslations('Statistics');
  const [isMounted, setIsMounted] = useState(false);
  const [sentiment, setSentiment] = useState<{
    strengths: string[];
    improvements: string[];
    expertInsight: string;
    benchmark: string | null;
    predictions: string | null;
    notEnoughData?: boolean;
  } | null>(null);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const isPulseOrZenith = planSlug === 'pulse' || planSlug === 'zenith';

  useEffect(() => {
    if (!isPulseOrZenith) return;
    let cancelled = false;
    (async () => {
      try {
        setSentimentError(null);
        const res = await fetch('/api/ai/statistics-sentiment');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setSentiment({
          strengths: data.strengths ?? [],
          improvements: data.improvements ?? [],
          expertInsight: data.expertInsight ?? '',
          benchmark: data.benchmark ?? null,
          predictions: data.predictions ?? null,
          notEnoughData: Boolean(data.notEnoughData),
        });
      } catch (e) {
        if (!cancelled) setSentimentError(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPulseOrZenith]);

  const reputationScore = useMemo(() => {
    if (!reviews.length) return 0;
    const avg =
      reviews.reduce((s, r) => s + (r.rating >= 1 && r.rating <= 5 ? r.rating : 0), 0) /
      reviews.length;
    return Math.round((avg / 5) * 100);
  }, [reviews]);

  const averageResponseMinutes = useMemo(() => {
    const responded = reviews.filter((r) => r.responseText);
    if (!responded.length) return null;
    const base = 12 * 60;
    const factor = Math.max(0, 24 - Math.min(responded.length, 12)) * 15;
    return Math.round((base + factor) / 10) * 10;
  }, [reviews]);

  const aiWordsCount = useMemo(() => {
    return reviews
      .filter((r) => r.responseText)
      .reduce((s, r) => s + (r.responseText ?? '').split(/\s+/).filter(Boolean).length, 0);
  }, [reviews]);

  const tempsTotalGagne = useMemo(() => {
    const minsPer100Words = 2;
    const totalMins = Math.round((aiWordsCount / 100) * minsPer100Words);
    if (totalMins < 60) return `~${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
  }, [aiWordsCount]);

  const derniereReponse = useMemo(() => {
    const withResponse = reviews.filter((r) => r.responseText).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (!withResponse.length) return '—';
    const d = new Date(withResponse[0].createdAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return t('lastResponseNow');
    if (diffMins < 60) return t('lastResponseAgo', { count: diffMins });
    if (diffHours < 24) return t('lastResponseHoursAgo', { count: diffHours });
    return t('lastResponseDaysAgo', { count: diffDays });
  }, [reviews, t]);

  const comparisonData = useMemo(() => {
    if (!reviews.length) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();
    const buckets: { day: number; current: number; previous: number }[] = [];
    for (let d = 1; d <= 31; d++) buckets.push({ day: d, current: 0, previous: 0 });
    reviews.forEach((r) => {
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const day = d.getDate();
      if (day < 1 || day > 31) return;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        buckets[day - 1].current += 1;
      } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
        buckets[day - 1].previous += 1;
      }
    });
    return buckets.filter((b) => b.current > 0 || b.previous > 0);
  }, [reviews]);

  const topKeywords = useMemo(() => {
    const text = reviews.map((r) => r.comment).join(' ').toLowerCase();
    if (!text.trim()) return [];
    const cleaned = text.replace(/[.,;:!?()"«»]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((w) => w.length >= 3);
    const stopwords = new Set([
      'les',
      'des',
      'the',
      'and',
      'very',
      'not',
      'vous',
      'avec',
      'pour',
      'que',
      'qui',
      'sur',
      'est',
      'pas',
      'mais',
      'plus',
      'nous',
      'tres',
      'très',
      'vraiment',
      'peu',
      'trop',
      'bien',
      'tresbien',
      'super',
      'tresbon',
      'bon',
      'tresbonne',
      'tresbons',
      'tresbonne',
      'tresbelle',
      'tresagréable',
      'tresagréables',
      'tresgentil',
      'tresgentille',
      'tresgentils',
      'tresgentilles',
      'trespropre',
      'trespropres',
      'trescorrect',
      'trescorrecte',
      'trescorrectes',
      'tresrapide',
      'tresrapides',
      'tresbonnes',
      'tresbons',
      'tresbienveillant',
      'tresbienveillante',
      'tresbienveillants',
      'tresbienveillantes',
      'tresaccueillant',
      'tresaccueillante',
      'tresaccueillants',
      'tresaccueillantes',
      'tresagréable',
      'tresagréables',
    ]);
    const counts = new Map<string, number>();
    const isMeaningful = (token: string) => {
      const normalized = token.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalized.length < 3) return false;
      if (!/[a-z]/.test(normalized)) return false;
      if (!/[aeiouy]/.test(normalized)) return false;
      if (stopwords.has(normalized)) return false;
      // filtre les chaînes très bizarres (beaucoup de consonnes consécutives)
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(normalized)) return false;
      return true;
    };

    tokens.forEach((w) => {
      const n = w
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (!isMeaningful(n)) return;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));
  }, [reviews]);

  const responseTimeDisplay =
    averageResponseMinutes !== null
      ? averageResponseMinutes >= 60
        ? `${Math.floor(averageResponseMinutes / 60)}h ${averageResponseMinutes % 60}min`
        : `${averageResponseMinutes} min`
      : '—';

  const upgradeHref = `/${locale}/pricing`;

  const isSentimentLoading = isPulseOrZenith && !sentiment && !sentimentError;

  return (
    <div className="space-y-6">
      {/* KPIs Header */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${cardClass} flex items-center gap-4`}>
          <ReputationGauge score={reputationScore} />
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              {t('reputationScore')}
              <span
                className="inline-flex cursor-help text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title={t('reputationScoreTooltip')}
              >
                <Info className="w-3.5 h-3.5" />
              </span>
            </p>
            <p className="text-slate-800 dark:text-slate-100 font-display font-bold text-lg mt-0.5">
              0–100
            </p>
          </div>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('avgResponseTime')}
          </p>
          <p className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mt-1">
            {responseTimeDisplay}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('responseTimeSubtitle')}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('aiWordsGenerated')}
          </p>
          <p className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mt-1">
            {aiWordsCount.toLocaleString(locale)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {aiWordsCount > 0 ? t('onAverage') : t('aiWordsPlaceholder')}
          </p>
        </div>
      </section>

      {/* Évolution des notes + Comparaison mensuelle */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <RatingEvolutionChart reviews={reviews} locale={locale} />
        </div>
        <div className={cardClass}>
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3">
            {t('monthlyComparison')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('volumeDesc')}</p>
          <div className="h-44">
            {comparisonData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {t('noCompareData')}
              </div>
            ) : isMounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(226 232 240)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'rgb(100 116 139)' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(v, name) => [
                      `${v} ${t('reviewsPerStar')}`,
                      name === 'current' ? t('currentMonth') : t('previousMonth'),
                    ]}
                  />
                  <Line type="monotone" dataKey="current" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="previous" stroke="#94a3b8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full" />
            )}
          </div>
        </div>
      </section>

      {/* Impact Quotidien */}
      <section className={cardClass}>
        <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          {t('impactQuotidien')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">
              {t('tempsTotalGagne')}
            </p>
            <p className="text-xl font-display font-bold text-slate-800 dark:text-slate-100">
              {tempsTotalGagne}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5" />
              {t('derniereReponseEnvoyee')}
            </p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {derniereReponse}
            </p>
          </div>
        </div>
      </section>

      {/* Top keywords */}
      <section className={cardClass}>
        <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm mb-3">
          {t('topKeywords')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('topKeywordsDesc')}</p>
        {topKeywords.length === 0 ? (
          <p className="text-xs text-slate-400">{t('noEnoughText')}</p>
        ) : (
          <div className="relative max-h-32 overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              {topKeywords.map((k) => (
                <span
                  key={k.word}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
                >
                  <span className="font-medium">#{k.word}</span>
                  <span className="text-slate-400 text-[10px]">×{k.count}</span>
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent" />
          </div>
        )}
      </section>

      {/* Sentiment (Pulse+) */}
      <section className={cardClass}>
        <PaywallOverlay
          locked={!isPulseOrZenith}
          upgradeMessage={t('unlockPulse')}
          upgradeHref={upgradeHref}
        >
          <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            {t('whatClientsSay')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            {t('sentimentSectionDesc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">
                {t('strengths')}
              </p>
              <div className="flex flex-wrap gap-1.5 min-h-[32px] items-start">
                {isSentimentLoading ? (
                  <div className="flex flex-col gap-1 w-full max-w-xs">
                    <Skeleton className="h-3 w-32 rounded-full" />
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <Skeleton className="h-3 w-24 rounded-full" />
                  </div>
                ) : sentimentError ? (
                  <span className="text-xs text-slate-400">{t('insightsError')}</span>
                ) : sentiment?.notEnoughData ? (
                  <span className="text-xs text-slate-400">
                    Pas assez d&apos;avis sur cette période pour une analyse précise.
                  </span>
                ) : (
                  (sentiment?.strengths ?? []).map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs text-emerald-800 dark:text-emerald-200"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-2">
                {t('improvementAreas')}
              </p>
              <div className="flex flex-wrap gap-1.5 min-h-[32px] items-start">
                {isSentimentLoading ? (
                  <div className="flex flex-col gap-1 w-full max-w-xs">
                    <Skeleton className="h-3 w-28 rounded-full" />
                    <Skeleton className="h-3 w-24 rounded-full" />
                  </div>
                ) : sentiment?.notEnoughData ? (
                  <span className="text-xs text-slate-400">—</span>
                ) : sentimentError ? (
                  <span className="text-xs text-slate-400">—</span>
                ) : (sentiment?.improvements ?? []).length === 0 ? (
                  <span className="text-xs text-slate-400">{t('noEnoughText')}</span>
                ) : (
                  (sentiment?.improvements ?? []).map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-2.5 py-1 text-xs text-rose-800 dark:text-rose-200"
                    >
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
          <div className={`mt-2 transition-opacity duration-300 ${isSentimentLoading ? 'opacity-60' : 'opacity-100'}`}>
            {isSentimentLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              sentiment?.expertInsight && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    {t('expertInsight')}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{sentiment.expertInsight}</p>
                </div>
              )
            )}
          </div>
        </PaywallOverlay>
      </section>
    </div>
  );
}
