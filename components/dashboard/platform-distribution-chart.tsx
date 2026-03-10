'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';

type PlatformDistributionChartProps = {
  reviews: { source: string }[];
};

type PlatformKey = 'Google' | 'TripAdvisor' | 'Yelp' | 'Other';

type PieDatum = {
  name: PlatformKey;
  value: number;
  percentage: number;
};

const COLORS: Record<PlatformKey, string> = {
  Google: 'hsl(215 90% 52%)',
  TripAdvisor: 'hsl(175 80% 42%)',
  Yelp: 'hsl(0 72% 51%)',
  Other: 'hsl(220 10% 80%)',
};

function mapSourceToPlatform(sourceRaw: string | null | undefined): PlatformKey {
  const s = String(sourceRaw ?? '').toLowerCase();
  if (s.includes('trip') || s.includes('advisor')) return 'TripAdvisor';
  if (s.includes('yelp')) return 'Yelp';
  if (!s || s === 'null' || s === 'undefined') return 'Other';
  return 'Google';
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload || !payload.length) return null;
  const datum = payload[0].payload as PieDatum;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-slate-900 flex items-center gap-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: COLORS[datum.name] }}
        />
        {datum.name}
      </div>
      <div className="mt-1 text-slate-600">
        {datum.percentage.toFixed(0)}
        % des avis
      </div>
    </div>
  );
}

export function PlatformDistributionChart({ reviews }: PlatformDistributionChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const data: PieDatum[] = useMemo(() => {
    if (!reviews.length) {
      return [
        { name: 'Other', value: 1, percentage: 100 },
      ];
    }

    const counts: Record<PlatformKey, number> = {
      Google: 0,
      TripAdvisor: 0,
      Yelp: 0,
      Other: 0,
    };

    reviews.forEach((r) => {
      const p = mapSourceToPlatform(r.source);
      counts[p] += 1;
    });

    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

    return (Object.keys(counts) as PlatformKey[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({
        name: k,
        value: counts[k],
        percentage: (counts[k] / total) * 100,
      }));
  }, [reviews]);

  if (!isMounted) return null;
  const hasData = reviews.length > 0;

  return (
    <div className="flex items-center gap-5">
      <div className="w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="80%"
              outerRadius="90%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name]}
                  className="transition-all duration-200 origin-center hover:scale-105"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2.5">
        {hasData ? (
          data.map((d) => (
            <div key={d.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[d.name] }}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {d.name}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {d.percentage.toFixed(0)}%
              </span>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-slate-400">
            Répartition par plateforme affichée dès les premiers avis.
          </p>
        )}
      </div>
    </div>
  );
}

