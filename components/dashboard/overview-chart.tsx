'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
  startOfMonth,
  endOfMonth,
  differenceInDays,
  eachDayOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import { fr, enUS, es, de, it } from 'date-fns/locale';
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
  tooltipLabel: string;
  avgRating: number | null;
  sortKey: string;
  showTick?: boolean;
};

function CustomTooltip({
  active,
  payload,
  avgRatingLabel,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  avgRatingLabel: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as ChartPoint;
  if (point.avgRating == null) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900 dark:text-zinc-100">{point.tooltipLabel}</div>
      <div className="mt-1 text-slate-600 dark:text-zinc-400">
        {avgRatingLabel} : <span className="font-semibold">{point.avgRating.toFixed(2)}/5</span>
      </div>
    </div>
  );
}

export function OverviewChart({ reviews, locale }: OverviewChartProps) {
  const t = useTranslations('Chart');
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

  /** Génère une courbe mock oscillant entre 3.5 et 4.8, progression positive */
  const generateMockRating = (index: number, total: number): number => {
    const progress = total > 1 ? index / (total - 1) : 1;
    const base = 3.5 + progress * 1.2;
    const oscillation = Math.sin(index * 0.7) * 0.12;
    return Math.round(Math.min(4.8, Math.max(3.5, base + oscillation)) * 100) / 100;
  };

  const data: ChartPoint[] = useMemo(() => {
    const localeMap = { fr, en: enUS, es, de, it } as const;
    const localeObj = localeMap[locale as keyof typeof localeMap] ?? fr;
    const today = startOfDay(new Date());
    const now = endOfDay(today);

    const parsed = reviews
      .map((r) => {
        const d = new Date(r.createdAt);
        if (Number.isNaN(d.getTime())) return null;
        return { date: d, rating: r.rating };
      })
      .filter((v): v is { date: Date; rating: number } => v !== null);

    type PeriodMode = '7d' | '30d' | 'months';
    let fromDate: Date;
    let toDate: Date = now;
    let mode: PeriodMode;

    if (range === '7d') {
      fromDate = startOfDay(subDays(today, 6));
      toDate = now;
      mode = '7d';
    } else if (range === '30d') {
      fromDate = startOfDay(subDays(today, 29));
      toDate = now;
      mode = '30d';
    } else if (range === '6m') {
      fromDate = startOfMonth(subMonths(today, 5));
      toDate = endOfMonth(today);
      mode = 'months';
    } else if (range === 'all' && parsed.length > 0) {
      const minDate = new Date(Math.min(...parsed.map((p) => p.date.getTime())));
      fromDate = startOfMonth(minDate);
      toDate = endOfMonth(today);
      mode = 'months';
    } else if (range === 'custom' && customFrom && customTo) {
      fromDate = startOfDay(new Date(customFrom));
      toDate = endOfDay(new Date(customTo));
      const diff = differenceInDays(toDate, fromDate);
      mode = diff > 31 ? 'months' : diff > 7 ? '30d' : '7d';
    } else {
      fromDate = startOfMonth(subMonths(today, 5));
      toDate = endOfMonth(today);
      mode = 'months';
    }

    const filtered = parsed.filter(({ date }) => {
      if (isBefore(date, fromDate)) return false;
      if (isAfter(date, toDate)) return false;
      return true;
    });

    let periods: { date: Date; sortKey: string; label: string; tooltipLabel: string; showTick: boolean }[] = [];

    if (mode === '7d') {
      const days = eachDayOfInterval({ start: fromDate, end: today });
      periods = days.map((d, i) => {
        const isLast = i === days.length - 1;
        return {
          date: d,
          sortKey: format(d, 'yyyy-MM-dd'),
          label: isLast ? (locale === 'en' ? 'Today' : 'Aujourd\'hui') : format(d, 'EEEE', { locale: localeObj }),
          tooltipLabel: format(d, 'd MMMM yyyy', { locale: localeObj }),
          showTick: true,
        };
      });
    } else if (mode === '30d') {
      const days = eachDayOfInterval({ start: fromDate, end: today });
      periods = days.map((d, i) => ({
        date: d,
        sortKey: format(d, 'yyyy-MM-dd'),
        label: format(d, 'dd MMM', { locale: localeObj }),
        tooltipLabel: format(d, 'd MMMM yyyy', { locale: localeObj }),
        showTick: i % 5 === 0 || i === days.length - 1,
      }));
    } else {
      const months = eachMonthOfInterval({ start: fromDate, end: toDate });
      periods = months.map((d) => ({
        date: d,
        sortKey: format(d, 'yyyy-MM'),
        label: format(d, 'MMM', { locale: localeObj }),
        tooltipLabel: format(d, 'MMMM yyyy', { locale: localeObj }),
        showTick: true,
      }));
    }

    const buckets = new Map<string, { sum: number; count: number }>();
    filtered.forEach(({ date, rating }) => {
      const key = mode === 'months' ? format(date, 'yyyy-MM') : format(date, 'yyyy-MM-dd');
      const existing = buckets.get(key);
      if (existing) {
        existing.sum += rating;
        existing.count += 1;
      } else {
        buckets.set(key, { sum: rating, count: 1 });
      }
    });

    const hasRealData = buckets.size > 0;

    let rawPoints = periods.map(({ date, sortKey, label, tooltipLabel, showTick }, index) => {
      let avgRating: number | null;
      if (hasRealData) {
        const bucket = buckets.get(mode === 'months' ? format(date, 'yyyy-MM') : sortKey);
        avgRating = bucket ? bucket.sum / bucket.count : null;
      } else {
        avgRating = generateMockRating(index, periods.length);
      }
      return {
        date: sortKey,
        label: showTick ? label : '',
        tooltipLabel,
        avgRating,
        sortKey,
        showTick,
      };
    });

    // Interpolation : les jours sans data ne tombent pas à zéro
    rawPoints = rawPoints.map((p, i) => {
      if (p.avgRating != null) return p;
      const prev = rawPoints.slice(0, i).reverse().find((x) => x.avgRating != null)?.avgRating;
      const next = rawPoints.slice(i + 1).find((x) => x.avgRating != null)?.avgRating;
      const interpolated = prev != null && next != null
        ? (prev + next) / 2
        : prev ?? next ?? 4.0;
      return { ...p, avgRating: Math.round(interpolated * 100) / 100 };
    });

    return rawPoints;
  }, [reviews, locale, range, customFrom, customTo]);

  if (!isMounted) return null;

  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'hsl(220 13% 91%)';
  const axisColor = isDark ? 'hsl(215 20% 72%)' : 'hsl(220 9% 46%)';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-zinc-100">{t('title')}</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {range === 'all'
              ? t('periodAll')
              : range === 'custom'
                ? t('periodCustom')
                : `${t('periodLabel')} : ${t(`range${range}` as 'range7d' | 'range30d' | 'range6m' | 'rangeAll')}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(['7d', '30d', '6m', 'all', 'custom'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                range === r
                  ? 'bg-sky-600 text-white border-sky-600 shadow-inner ring-1 ring-sky-500/50'
                  : 'bg-white dark:bg-zinc-800/50 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/50'
              }`}
            >
              {r === 'custom' ? (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {t('rangeCustom')}
                </span>
              ) : (
                t(`range${r}` as 'range7d' | 'range30d' | 'range6m' | 'rangeAll')
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
              📅 {t('calendar')}
            </button>
          {showCustomPanel && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              className="absolute z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
            >
              <p className="mb-2 text-[11px] font-semibold text-slate-700">
                {t('customPanel')}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">{t('from')}</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-40 px-2 py-1 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 bg-white"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">{t('to')}</span>
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
                    {t('reset')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomPanel(false)}
                    className="rounded-full bg-sky-600 px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="relative h-52 w-full min-w-0 overflow-x-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          </div>
        )}
        <div className={isLoading ? 'h-full opacity-50 transition-opacity' : 'h-full transition-opacity'}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: axisColor }}
                minTickGap={12}
                interval="preserveStartEnd"
                angle={range === '7d' ? -20 : 0}
                textAnchor={range === '7d' ? 'end' : 'middle'}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: axisColor }}
                domain={[0, 5]}
                ticks={[5, 4, 3, 2, 1, 0]}
                allowDecimals={false}
                padding={{ top: 16, bottom: 8 }}
              />
              <Tooltip content={<CustomTooltip avgRatingLabel={t('avgRating')} />} wrapperStyle={{ maxWidth: 200 }} />
              <Line
                type="monotone"
                dataKey="avgRating"
                stroke="hsl(215 90% 52%)"
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: 'hsl(215 90% 52%)' }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!data.length && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            {t('noData')}
          </div>
        )}
      </div>
    </div>
  );
}

