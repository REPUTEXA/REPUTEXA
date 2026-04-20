'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

type PilotageCashVsLoyaltyChartProps = {
  cashCents: number;
  loyaltyCents: number;
  locale: string;
};

function formatEurCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function PilotageCashVsLoyaltyChart({
  cashCents,
  loyaltyCents,
  locale,
}: PilotageCashVsLoyaltyChartProps) {
  const t = useTranslations('Dashboard.bananoOmnipresent');

  const data = useMemo(
    () => [
      {
        period: t('cashVsLoyaltyPeriodLabel'),
        cash: Math.max(0, cashCents),
        loyalty: Math.max(0, loyaltyCents),
      },
    ],
    [cashCents, loyaltyCents, t]
  );

  return (
    <div className="mt-4 rounded-[14px] border border-zinc-600/50 bg-zinc-900/70 px-3 py-3 sm:px-4 sm:py-4 shadow-md shadow-black/20 ring-1 ring-white/5">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">
        {t('cashVsLoyaltyTitle')}
      </h4>
      <p className="mt-1 text-xs text-zinc-500">{t('cashVsLoyaltyHint')}</p>
      <div className="mt-3 h-[240px] w-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis dataKey="period" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
            <YAxis
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickFormatter={(v) => formatEurCents(Number(v), locale)}
              width={72}
            />
            <RechartsTooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs shadow-xl space-y-1">
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="tabular-nums text-zinc-200">
                        <span className="text-zinc-400">{p.name} : </span>
                        {formatEurCents(Number(p.value), locale)}
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => <span className="text-zinc-400">{value}</span>}
            />
            <Bar
              dataKey="cash"
              name={t('cashVsLoyaltyCashBar')}
              fill="#22c55e"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="loyalty"
              name={t('cashVsLoyaltyLoyaltyBar')}
              fill="#eab308"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
