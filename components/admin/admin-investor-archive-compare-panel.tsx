'use client';

import { useMemo, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { GitCompare, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  buildArchiveInsights,
  buildArchiveTimeline,
  type ArchiveTimelineRow,
  type InsightBullet,
} from '@/lib/admin/investor-archive-comparison';

/** Intl — évite i18next/no-literal-string sur les options DateTime. */
const ARCHIVE_ROW_DATETIME_OPTS: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
};

type ArchiveItem = {
  id: string;
  created_at: string;
  file_name: string;
  summary: Record<string, unknown> | null;
};

function useMoneyAndNumberFormatters(locale: string) {
  const eur = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }),
    [locale]
  );
  const num1 = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale]
  );
  const num0 = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    [locale]
  );

  return useMemo(
    () => ({
      formatEur(n: number | null | undefined): string {
        if (n == null || Number.isNaN(n)) return '—';
        return eur.format(n);
      },
      formatOneDecimal(n: number): string {
        return num1.format(n);
      },
      formatPct(n: number): string {
        return `${num1.format(n)}\u00a0%`;
      },
      formatPctSigned(n: number): string {
        const sign = n > 0 ? '+' : n < 0 ? '−' : '';
        return `${sign}${num1.format(Math.abs(n))}\u00a0%`;
      },
      formatPtsSigned(n: number): string {
        const sign = n > 0 ? '+' : n < 0 ? '−' : '';
        return `${sign}${num1.format(Math.abs(n))}\u00a0pts`;
      },
      formatInt(n: number): string {
        return num0.format(n);
      },
    }),
    [eur, num0, num1]
  );
}

function formatInsightText(
  b: InsightBullet,
  t: (key: string, values?: Record<string, string | number>) => string,
  fmt: ReturnType<typeof useMoneyAndNumberFormatters>
): string {
  switch (b.type) {
    case 'watch_single_export':
      return t('bulletWatchSingle');
    case 'watch_empty_series':
      return t('bulletWatchEmpty');
    case 'mrr_up': {
      const delta =
        b.deltaPct != null ? fmt.formatPctSigned(b.deltaPct) : `+${fmt.formatEur(b.deltaEur)}`;
      return t('bulletMrrUp', { prev: fmt.formatEur(b.prev), next: fmt.formatEur(b.next), delta });
    }
    case 'mrr_down': {
      const pctPart = b.deltaPct != null ? `\u00a0(${fmt.formatPct(b.deltaPct)})` : '';
      return t('bulletMrrDown', { amount: fmt.formatEur(b.absDeltaEur), pctPart });
    }
    case 'cash_up':
      return t('bulletCashUp', { amount: fmt.formatEur(b.delta) });
    case 'cash_down':
      return t('bulletCashDown', { amount: fmt.formatEur(b.delta) });
    case 'subs_up':
      return t('bulletSubsUp', { n: fmt.formatInt(b.delta) });
    case 'subs_down':
      return t('bulletSubsDown', { n: fmt.formatInt(b.delta) });
    case 'margin_up':
      return t('bulletMarginUp', { pts: fmt.formatPtsSigned(b.deltaPts) });
    case 'margin_down':
      return t('bulletMarginDown', { pts: fmt.formatPtsSigned(b.deltaPts) });
    case 'burn_up':
      return t('bulletBurnUp', { amount: fmt.formatEur(b.delta) });
    case 'burn_down':
      return t('bulletBurnDown', { amount: fmt.formatEur(b.absDelta) });
    case 'openai_error':
      return t('bulletOpenaiError', { error: b.error });
    case 'unmatched':
      return t('bulletUnmatched', { count: b.count });
    default: {
      const _exhaustive: never = b;
      return _exhaustive;
    }
  }
}

function DeltaCell({
  eur,
  pct,
  formatEur,
  formatPct,
}: {
  eur: number | null;
  pct: number | null;
  formatEur: (n: number | null | undefined) => string;
  formatPct: (n: number) => string;
}) {
  if (eur == null && pct == null) return <span className="text-zinc-600">—</span>;
  const good = eur != null ? eur >= 0 : pct != null && pct >= 0;
  const cls = good ? 'text-emerald-400' : 'text-red-400';
  return (
    <span className={`tabular-nums font-medium ${cls}`}>
      {eur != null ? <>{formatEur(eur)} </> : null}
      {pct != null ? (
        <span className="text-zinc-500 font-normal text-[10px]">({formatPct(pct)})</span>
      ) : null}
    </span>
  );
}

function marginTone(v: number | null): string {
  if (v == null) return 'text-zinc-500';
  if (v >= 45) return 'text-emerald-300';
  if (v >= 15) return 'text-zinc-200';
  return 'text-amber-300';
}

export function AdminInvestorArchiveComparePanel({ archives }: { archives: ArchiveItem[] }) {
  const locale = useLocale();
  const t = useTranslations('Dashboard.adminInvestorArchiveCompare');
  const fmt = useMoneyAndNumberFormatters(locale);
  const timeline = useMemo(() => buildArchiveTimeline(archives), [archives]);
  const insights = useMemo(() => buildArchiveInsights(timeline), [timeline]);

  const introTags = useMemo(
    () => ({
      b: (chunks: ReactNode) => <strong className="text-zinc-400">{chunks}</strong>,
    }),
    []
  );

  if (archives.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 pt-5 border-t border-violet-500/15 space-y-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-200/90 uppercase tracking-wider">
        <GitCompare className="w-4 h-4 text-violet-400" />
        {t('sectionTitle')}
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed max-w-3xl">{t.rich('introRich', introTags)}</p>

      {insights.spanMeta ? (
        <p className="text-[11px] font-mono text-zinc-500">
          {insights.spanMeta.days === 1
            ? t('spanOne', { count: insights.spanMeta.exportCount })
            : t('spanMany', { count: insights.spanMeta.exportCount, days: insights.spanMeta.days })}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/90 mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            {t('positiveTitle')}
          </div>
          {insights.bulletsPositive.length === 0 ? (
            <p className="text-[11px] text-zinc-600">{t('emptyPositive')}</p>
          ) : (
            <ul className="space-y-1.5 text-[11px] text-emerald-100/90 leading-snug list-disc pl-4">
              {insights.bulletsPositive.map((b, i) => (
                <li key={i}>{formatInsightText(b, t, fmt)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-950/15 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300/90 mb-2">
            <TrendingDown className="w-3.5 h-3.5" />
            {t('negativeTitle')}
          </div>
          {insights.bulletsNegative.length === 0 ? (
            <p className="text-[11px] text-zinc-600">{t('emptyNegative')}</p>
          ) : (
            <ul className="space-y-1.5 text-[11px] text-red-100/85 leading-snug list-disc pl-4">
              {insights.bulletsNegative.map((b, i) => (
                <li key={i}>{formatInsightText(b, t, fmt)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 px-3 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300/90 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('watchTitle')}
          </div>
          {insights.bulletsWatch.length === 0 ? (
            <p className="text-[11px] text-zinc-600">{t('emptyWatch')}</p>
          ) : (
            <ul className="space-y-1.5 text-[11px] text-amber-100/85 leading-snug list-disc pl-4">
              {insights.bulletsWatch.map((b, i) => (
                <li key={i}>{formatInsightText(b, t, fmt)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800/90">
        <table className="min-w-[1060px] w-full text-left text-[11px]">
          <thead className="bg-zinc-950/90 text-zinc-500 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 font-medium">{t('thExportDate')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thMrr')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thDeltaMrr')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thTreasury')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thDeltaTreasury')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thSubs')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thDeltaSubs')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thMargin')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thBurn')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thDeltaMarginPts')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('thPdf')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {timeline.map((row: ArchiveTimelineRow) => (
              <tr key={row.archiveId} className="bg-zinc-900/15 hover:bg-zinc-900/35">
                <td className="px-3 py-2 text-zinc-300">
                  <span className="font-mono text-[10px] text-zinc-400 block">
                    {new Date(row.exportedAt).toLocaleString(locale, ARCHIVE_ROW_DATETIME_OPTS)}
                  </span>
                  <span className="text-zinc-500 truncate max-w-[160px] block" title={row.fileName}>
                    {row.fileName}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                  {fmt.formatEur(row.summary.mrrEur)}
                </td>
                <td className="px-3 py-2 text-right">
                  <DeltaCell
                    eur={row.deltaMrrEur}
                    pct={row.deltaMrrPct}
                    formatEur={fmt.formatEur}
                    formatPct={fmt.formatPct}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-200">
                  {fmt.formatEur(row.summary.totalCashEur)}
                </td>
                <td className="px-3 py-2 text-right">
                  <DeltaCell
                    eur={row.deltaCashEur}
                    pct={row.deltaCashPct}
                    formatEur={fmt.formatEur}
                    formatPct={fmt.formatPct}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                  {row.summary.activeSubscriptions ?? '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.deltaAbos == null ? (
                    <span className="text-zinc-600">—</span>
                  ) : (
                    <span className={row.deltaAbos >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {row.deltaAbos >= 0 ? '+' : ''}
                      {row.deltaAbos}
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${marginTone(row.summary.contributionMarginPct)}`}>
                  {row.summary.contributionMarginPct != null
                    ? t('pctCell', { value: fmt.formatOneDecimal(row.summary.contributionMarginPct) })
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-200/80">
                  {fmt.formatEur(row.summary.burnMonthEur)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.deltaMarginPts == null ? (
                    <span className="text-zinc-600">—</span>
                  ) : (
                    <span className={row.deltaMarginPts >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {row.deltaMarginPts >= 0 ? '+' : ''}
                      {fmt.formatOneDecimal(row.deltaMarginPts)}
                      {t('ptsSuffix')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <a
                    href={`/api/admin/investor-report-archive/${row.archiveId}/download`}
                    className="inline-flex rounded border border-violet-700/50 px-2 py-0.5 text-violet-200 hover:bg-violet-950/50"
                  >
                    {t('download')}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-zinc-600">{t('footnote')}</p>
    </div>
  );
}
