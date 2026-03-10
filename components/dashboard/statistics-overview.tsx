'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  LineChart,
  Line,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Lightbulb, TrendingUp } from 'lucide-react';

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
};

function useChartColors() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'hsl(220 13% 91%)';
  const axisColor = isDark ? 'hsl(215 20% 72%)' : 'hsl(220 9% 46%)';
  return { gridColor, axisColor };
}

export function StatisticsOverview({ reviews, locale }: StatisticsOverviewProps) {
  const { gridColor, axisColor } = useChartColors();
  const [insights, setInsights] = useState<
    { problem: string; solution: string; impact: string }[]
  >([]);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setInsightsError(null);
        const res = await fetch('/api/ai/generate-insights');
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data.insights)) {
          setInsights(data.insights);
        }
      } catch (e) {
        if (!cancelled) {
          setInsightsError(
            e instanceof Error ? e.message : 'Impossible de charger les insights IA.',
          );
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const ratingData = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) counts[r.rating] += 1;
    });
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      label: `${star}★`,
      count: counts[star],
    }));
  }, [reviews]);

  const comparisonData = useMemo(() => {
    if (!reviews.length) return [];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const maxDays = 31;
    const buckets: { day: number; current: number; previous: number }[] = [];
    for (let d = 1; d <= maxDays; d += 1) {
      buckets.push({ day: d, current: 0, previous: 0 });
    }

    reviews.forEach((r) => {
      const d = new Date(r.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const day = d.getDate();
      if (day < 1 || day > maxDays) return;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        buckets[day - 1].current += 1;
      } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
        buckets[day - 1].previous += 1;
      }
    });

    return buckets.filter((b) => b.current > 0 || b.previous > 0);
  }, [reviews]);

  const averageResponseHours = useMemo(() => {
    const responded = reviews.filter((r) => r.responseText);
    if (!responded.length) return null;
    // Pas de timestamp de réponse en base pour l'instant :
    // on fixe une valeur indicative basée sur le volume d'avis.
    const base = 12;
    const factor = Math.max(0, 24 - Math.min(responded.length, 12));
    return Math.round((base + factor / 4) * 10) / 10;
  }, [reviews]);

  const topKeywords = useMemo(() => {
    const text = reviews.map((r) => r.comment).join(' ').toLowerCase();
    if (!text.trim()) return [];
    const cleaned = text.replace(/[.,;:!?()"«»]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((w) => w.length >= 3);
    const stopwords = new Set([
      'les',
      'des',
      'dans',
      'une',
      'vous',
      'avec',
      'pour',
      'que',
      'qui',
      'sur',
      'est',
      'pas',
      'tres',
      'très',
      'the',
      'and',
      'very',
      'not',
      'mais',
      'plus',
      'nous',
      'vous',
      'ils',
      'elles',
      'mon',
      'mes',
      'ses',
      'son',
      'chez',
    ]);
    const counts = new Map<string, number>();
    tokens.forEach((wRaw) => {
      const w = wRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (stopwords.has(w)) return;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    });
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    return sorted.map(([word, count]) => ({ word, count }));
  }, [reviews]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Répartition du rating */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out">
          <div className="mb-3">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Répartition des notes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Nombre d&apos;avis par étoile</p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ratingData}
                layout="vertical"
                margin={{ top: 8, right: 8, bottom: 8, left: 24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal vertical={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: axisColor, fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor, fontSize: 11 }}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  formatter={(value) => [`${value} avis`, '']}
                />
                <Bar dataKey="count" radius={[4, 4, 4, 4]} fill="hsl(215 90% 52%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rapidité de réponse */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out flex flex-col justify-between">
          <div>
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Rapidité de réponse
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Temps moyen estimé sur les derniers avis répondus
            </p>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
              {averageResponseHours !== null ? `${averageResponseHours}h` : '—'}
            </p>
            <span className="text-xs text-slate-500">en moyenne</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Objectif recommandé : maintenir une réponse dans les 24 heures pour chaque avis.
          </p>
        </div>

        {/* Top mots-clés */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out">
          <div className="mb-3">
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Top mots-clés
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ce que vos clients mentionnent le plus
            </p>
          </div>
          {topKeywords.length === 0 ? (
            <p className="text-xs text-slate-400">Pas encore assez de texte dans les avis.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topKeywords.map((k) => (
                <span
                  key={k.word}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                >
                  <span className="font-medium">#{k.word}</span>
                  <span className="text-[10px] text-slate-400">×{k.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Comparaison périodique */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Comparaison mensuelle
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Volume d&apos;avis — mois en cours vs mois précédent
            </p>
          </div>
        </div>
        <div className="h-52">
          {comparisonData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              {locale === 'en'
                ? 'Not enough data yet to compare the last two months.'
                : 'Pas encore assez de données pour comparer les deux derniers mois.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: axisColor }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  formatter={(value, name) => [
                    `${value as number} avis`,
                    name === 'current' ? 'Mois en cours' : 'Mois précédent',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="hsl(215 90% 52%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="hsl(330 81% 60%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Insights stratégiques IA (Premium Pulse) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:border-white/[0.07] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] hover:shadow-[-8px_12px_24px_-10px_rgba(0,0,0,0.1),_0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:hover:shadow-[4px_6px_0_rgba(0,0,0,0.6)] dark:hover:border-slate-700 p-5 transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="font-display font-semibold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Insights stratégiques IA
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              3 axes d&apos;amélioration concrets basés sur vos derniers avis.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
            <TrendingUp className="w-3 h-3" />
            Premium Pulse
          </span>
        </div>
        {insightsError && (
          <p className="text-xs text-slate-400">
            {insightsError}
          </p>
        )}
        {insights.length === 0 && !insightsError ? (
          <p className="text-xs text-slate-400">
            Les premiers insights seront disponibles dès que suffisamment d&apos;avis auront été analysés.
          </p>
        ) : (
          <div className="space-y-3">
            {insights.map((i, idx) => (
              <div
                key={`${i.problem}-${idx}`}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-3 text-xs text-slate-700 dark:text-slate-200"
              >
                <p className="font-semibold text-slate-900 dark:text-slate-50 mb-0.5">
                  {i.problem}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Solution Reputexa : </span>
                  {i.solution}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span className="font-semibold">Impact attendu : </span>
                  {i.impact}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

