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
  startOfDay,
  endOfDay,
  startOfMonth,
  differenceInDays,
  eachDayOfInterval,
  eachMonthOfInterval,
} from 'date-fns';
import { fr, enUS, es, de, it, ptBR, ja, zhCN } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';

const OVERVIEW_CHART_PRIMARY = '#2563eb';

type ChartReview = {
  createdAt: string;
  rating: number;
};

type OverviewChartProps = {
  reviews: ChartReview[];
  locale: string;
};

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
  formatRatingLine,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  formatRatingLine: (avg: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as ChartPoint;
  if (point.avgRating == null) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900 dark:text-zinc-100">{point.tooltipLabel}</div>
      <div className="mt-1 text-slate-600 dark:text-zinc-400">
        <span className="font-semibold">{formatRatingLine(point.avgRating)}</span>
      </div>
    </div>
  );
}

export function OverviewChart({ reviews, locale }: OverviewChartProps) {
  const t = useTranslations('Chart');
  const [isMounted, setIsMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const periodParam = searchParams.get('period') as '7d' | '30d' | '3m' | '12m' | null;

  /** Génère une courbe mock oscillant entre 3.5 et 4.8, progression positive */
  const generateMockRating = (index: number, total: number): number => {
    const progress = total > 1 ? index / (total - 1) : 1;
    const base = 3.5 + progress * 1.2;
    const oscillation = Math.sin(index * 0.7) * 0.12;
    return Math.round(Math.min(4.8, Math.max(3.5, base + oscillation)) * 100) / 100;
  };

  const data: ChartPoint[] = useMemo(() => {
    const localeMap: Record<string, DateFnsLocale> = {
      fr,
      en: enUS,
      es,
      de,
      it,
      pt: ptBR,
      ja,
      zh: zhCN,
    };
    const localeObj = localeMap[locale] ?? fr;
    const today = startOfDay(new Date());

    const parsed = reviews
      .map((r) => {
        const d = new Date(r.createdAt);
        if (Number.isNaN(d.getTime())) return null;
        return { date: d, rating: r.rating };
      })
      .filter((v): v is { date: Date; rating: number } => v !== null);

    let fromDate: Date;
    let toDate: Date;

    if (fromParam && toParam) {
      const f = new Date(fromParam);
      const t = new Date(toParam);
      if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
        fromDate = startOfDay(f);
        toDate = endOfDay(t);
      } else {
        fromDate = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1));
        toDate = endOfDay(today);
      }
    } else {
      fromDate = startOfMonth(new Date(today.getFullYear(), today.getMonth() - 5, 1));
      toDate = endOfDay(today);
    }

    const diffDays = Math.max(1, differenceInDays(toDate, fromDate) + 1);
    type PeriodMode = 'days' | 'months';
    let mode: PeriodMode;

    if (periodParam === '12m' || diffDays > 60) {
      mode = 'months';
    } else if (periodParam === '3m' || diffDays > 31) {
      mode = 'months';
    } else {
      mode = 'days';
    }

    const filtered = parsed.filter(({ date }) => {
      if (date < fromDate) return false;
      if (date > toDate) return false;
      return true;
    });

    let periods: {
      date: Date;
      sortKey: string;
      label: string;
      tooltipLabel: string;
      showTick: boolean;
    }[] = [];

    if (mode === 'days') {
      const days = eachDayOfInterval({ start: fromDate, end: toDate });
      periods = days.map((d, i) => ({
        date: d,
        sortKey: format(d, 'yyyy-MM-dd'),
        label: format(d, diffDays <= 7 ? 'EEE' : 'dd MMM', { locale: localeObj }),
        tooltipLabel: format(d, 'd MMMM yyyy', { locale: localeObj }),
        showTick: diffDays <= 7 ? true : i % 5 === 0 || i === days.length - 1,
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
      const interpolated =
        prev != null && next != null ? (prev + next) / 2 : prev ?? next ?? 4.0;
      return { ...p, avgRating: Math.round(interpolated * 100) / 100 };
    });

    return rawPoints;
  }, [reviews, locale, fromParam, toParam, periodParam]);

  if (!isMounted) return null;

  const isDark = resolvedTheme === 'dark';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.18)' : 'hsl(220 13% 91%)';
  const axisColor = isDark ? 'hsl(215 20% 72%)' : 'hsl(220 9% 46%)';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-display font-semibold text-slate-900 dark:text-zinc-100">
            {t('title')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {fromParam && toParam
              ? `${t('periodLabel')} : ${fromParam} → ${toParam}`
              : t('periodAll')}
          </p>
        </div>
      </div>

      <div className="relative h-52 w-full min-w-0 overflow-x-hidden">
        <div className="h-full transition-opacity duration-300">
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
              <Tooltip
                content={
                  <CustomTooltip
                    formatRatingLine={(avg) =>
                      t('tooltipAvgRating', { label: t('avgRating'), value: avg.toFixed(2) })
                    }
                  />
                }
                wrapperStyle={{ maxWidth: 200 }}
              />
              <Line
                type="monotone"
                dataKey="avgRating"
                stroke={OVERVIEW_CHART_PRIMARY}
                strokeWidth={1.5}
                dot={{ r: 2.5, fill: OVERVIEW_CHART_PRIMARY }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!data.length && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            {t('noData')}
          </div>
        )}
      </div>
    </div>
  );
}

