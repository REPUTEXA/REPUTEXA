'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  format,
  subDays,
  subMonths,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  differenceInDays,
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useTheme } from 'next-themes';

type ChartReview = {
  createdAt: string;
  rating: number;
};

type OverviewChartProps = {
  reviews: ChartReview[];
  locale: string;
};

type RangeKey = '7d' | '30d' | '6m' | 'all' | 'custom';

type ChartPoint = {
  date: string;
  label: string;
  avgRating: number;
};

const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7j' },
  { key: '30d', label: '30j' },
  { key: '6m', label: '6m' },
  { key: 'all', label: 'Tout' },
  { key: 'custom', label: 'Perso' },
];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as ChartPoint;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900">{point.label}</div>
      <div className="mt-1 text-slate-600">
        Note moyenne : <span className="font-semibold">{point.avgRating.toFixed(2)}/5</span>
      </div>
    </div>
  );
}

export function OverviewChart({ reviews, locale }: OverviewChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [range, setRange] = useState<RangeKey>('6m');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (range === 'custom') return;
    setIsLoading(true);
    const id = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(id);
  }, [range]);

  useEffect(() => {
    if (range !== 'custom') return;
    setIsLoading(true);
    const id = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(id);
  }, [range, customFrom, customTo]);

  const data: ChartPoint[] = useMemo(() => {
    if (!reviews.length) return [];

    const localeObj = locale === 'en' ? enUS : fr;
    const now = new Date();

    const parsed = reviews
      .map((r) => {
        const d = new Date(r.createdAt);
        if (Number.isNaN(d.getTime())) return null;
        return { date: d, rating: r.rating };
      })
      .filter((v): v is { date: Date; rating: number } => v !== null);

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (range === '7d') {
      fromDate = subDays(now, 7);
    } else if (range === '30d') {
      fromDate = subDays(now, 30);
    } else if (range === '6m') {
      fromDate = subMonths(now, 6);
    } else if (range === 'custom') {
      if (customFrom) fromDate = startOfDay(new Date(customFrom));
      if (customTo) toDate = endOfDay(new Date(customTo));
    }

    const filtered = parsed.filter(({ date }) => {
      if (fromDate && isBefore(date, fromDate)) return false;
      if (toDate && isAfter(date, toDate)) return false;
      return true;
    });

    if (!filtered.length) return [];

    let groupByMonth = false;
    if (range === '6m' || range === 'all') {
      groupByMonth = true;
    } else if (range === 'custom' && fromDate && toDate) {
      const diff = differenceInDays(toDate, fromDate);
      if (diff > 60) groupByMonth = true;
    }

    const buckets = new Map<string, { sum: number; count: number; date: Date }>();

    filtered.forEach(({ date, rating }) => {
      const key = groupByMonth ? format(date, 'yyyy-MM') : format(date, 'yyyy-MM-dd');
      const existing = buckets.get(key);
      if (existing) {
        existing.sum += rating;
        existing.count += 1;
      } else {
        buckets.set(key, { sum: rating, count: 1, date });
      }
    });

    const points = Array.from(buckets.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ date, sum, count }) => {
        const iso = format(date, groupByMonth ? 'yyyy-MM' : 'yyyy-MM-dd');
        return {
          date: iso,
          label: format(date, groupByMonth ? 'MMM yyyy' : 'dd MMM yyyy', {
            locale: localeObj,
          }),
          avgRating: sum / count,
        };
      });

    return points;
  }, [reviews, locale, range, customFrom, customTo]);

  if (!isMounted) return null;

  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'hsl(220 13% 91%)';
  const axisColor = isDark ? 'hsl(215 20% 72%)' : 'hsl(220 9% 46%)';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-slate-900">Évolution de la note</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {range === 'all'
              ? 'Toutes les périodes'
              : range === 'custom'
                ? 'Plage personnalisée'
                : `Période : ${
                    RANGE_LABELS.find((r) => r.key === range)?.label ?? '6m'
                  }`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGE_LABELS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                range === r.key
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r.key === 'custom' ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {r.label}
                </span>
              ) : (
                r.label
              )}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div className="relative inline-block text-xs text-slate-600">
          <button
            type="button"
            onClick={() => setShowCustomPanel((v) => !v)}
            className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 font-medium shadow-sm hover:bg-slate-50 transition-colors"
          >
            📅 Calendrier
          </button>
          {showCustomPanel && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="absolute z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <p className="mb-2 text-[11px] font-semibold text-slate-700">
                Plage personnalisée
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Du</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-40 px-2 py-1 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Au</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-40 px-2 py-1 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFrom('');
                      setCustomTo('');
                    }}
                    className="rounded-full px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
                  >
                    Réinitialiser
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomPanel(false)}
                    className="rounded-full bg-sky-600 px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="relative h-52">
        {isLoading && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          </div>
        )}
        <div className={isLoading ? 'h-full opacity-50 transition-opacity' : 'h-full transition-opacity'}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="ratingArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(215 90% 52%)" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="hsl(215 90% 52%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: axisColor }}
                minTickGap={24}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: axisColor }}
                domain={[3, 5]}
                padding={{ top: 16, bottom: 4 }}
                allowDecimals
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="avgRating"
                stroke="hsl(215 90% 52%)"
                strokeWidth={2.6}
                fill="url(#ratingArea)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {!data.length && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            {locale === 'en'
              ? 'No data yet for this period.'
              : 'Pas encore de données pour cette période.'}
          </div>
        )}
      </div>
    </div>
  );
}

