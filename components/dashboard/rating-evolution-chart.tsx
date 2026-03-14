'use client';

import { useMemo, useState, useId } from 'react';
import { useTheme } from 'next-themes';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { format, subDays, startOfDay } from 'date-fns';
import { fr, enUS, es, de, it } from 'date-fns/locale';

type ReviewItem = {
  rating: number;
  createdAt: string;
};

type RatingEvolutionChartProps = {
  reviews: ReviewItem[];
  locale: string;
};

const dateLocaleMap = { fr, en: enUS, es, de, it, pt: enUS, ja: enUS, zh: enUS } as const;

export function RatingEvolutionChart({ reviews, locale }: RatingEvolutionChartProps) {
  const t = useTranslations('Statistics');
  const { resolvedTheme } = useTheme();
  const [period, setPeriod] = useState<7 | 14 | 30 | 90>(90);
  const gradientId = `rating-grad-${useId().replace(/:/g, '')}`;
  const isDark = resolvedTheme === 'dark';
  const gridStroke = isDark ? 'rgba(148,163,184,0.18)' : 'rgb(226 232 240)';
  const tickFill = isDark ? 'rgb(148 163 184)' : 'rgb(100 116 139)';

  const localeObj = dateLocaleMap[locale as keyof typeof dateLocaleMap] ?? fr;

  const evolutionChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const days: { label: string; rating: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const nextDay = subDays(today, i - 1);
      const dayReviews = reviews.filter((r) => {
        const created = new Date(r.createdAt);
        if (Number.isNaN(created.getTime())) return false;
        if (r.rating < 1 || r.rating > 5) return false;
        return created >= d && created < nextDay;
      });
      const avg =
        dayReviews.length > 0
          ? dayReviews.reduce((s, r) => s + r.rating, 0) / dayReviews.length
          : 0;
      const label =
        period === 7 ? format(d, 'EEE', { locale: localeObj }) : format(d, 'd MMM', { locale: localeObj });
      days.push({ label, rating: avg });
    }
    let last = 0;
    return days.map((item) => {
      const r = item.rating > 0 ? item.rating : last;
      if (item.rating > 0) last = item.rating;
      return { ...item, rating: r };
    });
  }, [reviews, period, localeObj]);

  return (
    <div className="min-w-0 w-full">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="font-display font-semibold text-slate-800 dark:text-slate-100 text-sm">
          {t('ratingEvolution')}
        </h2>
        <div className="flex gap-1">
          {([7, 14, 30, 90] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {t(`period${p}d`)}
            </button>
          ))}
        </div>
      </div>
      <div className="h-52 min-h-[200px] w-full" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={evolutionChartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: 11 }} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tickLine={false} axisLine={false} tick={{ fill: tickFill, fontSize: 11 }} width={24} />
            <RechartsTooltip
              formatter={(value, _n, props) => [
                `${(props?.payload as { label?: string })?.label ?? ''}: ${Number(value ?? 0).toFixed(2)}/5`,
                '',
              ]}
            />
            <Area
              type="monotone"
              dataKey="rating"
              stroke="#2563eb"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
