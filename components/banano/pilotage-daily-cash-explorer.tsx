'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PilotageDailyActivityRow, PilotageWeekSummaryRow } from '@/lib/banano/pilotage/types';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

const TABLE_PAGE = 10;

type Props = { open: boolean; onClose: () => void };

function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function subMonthYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PilotageDailyCashExplorer({ open, onClose }: Props) {
  const t = useTranslations('Dashboard.bananoPilotageDaily');
  const locale = useLocale();
  const intlTag = siteLocaleToIntlDateTag(locale);
  const fmtEur = useCallback(
    (cents: number) =>
      new Intl.NumberFormat(intlTag, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      }).format(cents / 100),
    [intlTag]
  );
  const [granularity, setGranularity] = useState<'day' | 'week'>('day');
  const [monthYm, setMonthYm] = useState(ymNow);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState('');
  const [daily, setDaily] = useState<PilotageDailyActivityRow[]>([]);
  const [weekly, setWeekly] = useState<PilotageWeekSummaryRow[]>([]);
  const [page, setPage] = useState(0);

  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    let ym = ymNow();
    for (let i = 0; i < 36; i++) {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      out.push({
        value: ym,
        label: d.toLocaleDateString(intlTag, { month: 'long', year: 'numeric' }),
      });
      ym = subMonthYm(ym, -1);
    }
    return out;
  }, [intlTag]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    setPage(0);
    try {
      const qs = new URLSearchParams();
      if (useCustom && customFrom && customTo) {
        qs.set('from', customFrom);
        qs.set('to', customTo);
      } else {
        qs.set('month', monthYm);
      }
      qs.set('granularity', granularity);
      qs.set('locale', locale);
      const r = await fetch(`/api/banano/pilotage/daily-activity?${qs}`);
      const j = (await r.json()) as {
        error?: string;
        periodLabel?: string;
        periodLabelFr?: string;
        daily?: PilotageDailyActivityRow[];
        weekly?: PilotageWeekSummaryRow[];
      };
      if (!r.ok) throw new Error(j.error ?? t('errGeneric'));
      setPeriodLabel(j.periodLabel ?? j.periodLabelFr ?? '');
      setDaily(j.daily ?? []);
      setWeekly(j.weekly ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
      setDaily([]);
      setWeekly([]);
    } finally {
      setLoading(false);
    }
  }, [open, useCustom, customFrom, customTo, monthYm, granularity, locale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const flatLen = granularity === 'day' ? daily.length : weekly.length;
  const pageCount = Math.max(1, Math.ceil(flatLen / TABLE_PAGE));
  const sliceStart = page * TABLE_PAGE;
  const sliceDaily = daily.slice(sliceStart, sliceStart + TABLE_PAGE);
  const sliceWeek = weekly.slice(sliceStart, sliceStart + TABLE_PAGE);

  useEffect(() => {
    const last = Math.max(0, pageCount - 1);
    if (page > last) setPage(last);
  }, [page, pageCount]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal={true}
      aria-labelledby="pilotage-daily-cash-title"
    >
      <div className="relative w-full sm:max-w-5xl max-h-[min(96vh,900px)] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h2
            id="pilotage-daily-cash-title"
            className="text-sm font-bold text-slate-900 dark:text-slate-50"
          >
            {t('title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 flex flex-col gap-3 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/50">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('period')}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{periodLabel}</span>
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => {
                setUseCustom(false);
                setMonthYm(ymNow());
              }}
              className="min-h-[36px] px-3 rounded-lg text-xs font-semibold bg-[#2563eb] text-white"
            >
              {t('thisMonth')}
            </button>
            <button
              type="button"
              onClick={() => {
                setUseCustom(false);
                setMonthYm(subMonthYm(ymNow(), -1));
              }}
              className="min-h-[36px] px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-600"
            >
              {t('lastMonth')}
            </button>
            <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
              {t('monthLabel')}
              <select
                value={useCustom ? '' : monthYm}
                onChange={(e) => {
                  setUseCustom(false);
                  setMonthYm(e.target.value);
                }}
                disabled={useCustom}
                className="min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs capitalize"
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                />
                {t('customRange')}
              </label>
              <input
                type="date"
                disabled={!useCustom}
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs disabled:opacity-40"
              />
              <span className="text-slate-400" aria-hidden>
                {t('dateRangeArrow')}
              </span>
              <input
                type="date"
                disabled={!useCustom}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="min-h-[32px] px-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs disabled:opacity-40"
              />
              <button
                type="button"
                disabled={!useCustom || !customFrom || !customTo}
                onClick={() => void load()}
                className="min-h-[32px] px-3 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-40"
              >
                {t('refresh')}
              </button>
            </div>
            <div className="flex rounded-lg border border-slate-200 dark:border-zinc-700 p-0.5 ml-auto">
              <button
                type="button"
                onClick={() => setGranularity('day')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  granularity === 'day'
                    ? 'bg-[#2563eb] text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('byDay')}
              </button>
              <button
                type="button"
                onClick={() => setGranularity('week')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  granularity === 'week'
                    ? 'bg-[#2563eb] text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t('byWeek')}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              {t('loading')}
            </div>
          ) : err ? (
            <p className="text-sm text-red-600 dark:text-red-400 py-8 text-center">{err}</p>
          ) : granularity === 'day' ? (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
              <table className="w-full text-left text-xs sm:text-sm min-w-[720px]">
                <thead className="bg-slate-50 dark:bg-zinc-900/80 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t('thDay')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thPass')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thCa')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thAvg')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thArt')}</th>
                    <th className="px-3 py-2 font-semibold">{t('thTop')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {sliceDaily.map((row) => (
                    <tr key={row.dateKey}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                        {row.labelFr}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.visitCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.revenueCents > 0 ? fmtEur(row.revenueCents) : t('emptyCell')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.avgBasketCents != null ? fmtEur(row.avgBasketCents) : t('emptyCell')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.itemsSold != null ? row.itemsSold : '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px] leading-relaxed">
                        {row.topLabels.length > 0
                          ? row.topLabels.map((l, idx) => (
                              <span key={`${row.dateKey}-${l.text}-${idx}`}>
                                {idx > 0 ? t('topLabelSep') : null}
                                {t('topLabelEntry', { label: l.text, count: l.count })}
                              </span>
                            ))
                          : t('emptyCell')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
              <table className="w-full text-left text-xs sm:text-sm min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-zinc-900/80 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t('thWeek')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thPass')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thCa')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thAvg')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('thArt')}</th>
                    <th className="px-3 py-2 font-semibold">{t('thTop')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {sliceWeek.map((row) => (
                    <tr key={row.weekKey}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                        {row.labelFr}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.visitCount}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.revenueCents > 0 ? fmtEur(row.revenueCents) : t('emptyCell')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.avgBasketCents != null ? fmtEur(row.avgBasketCents) : t('emptyCell')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.itemsSold != null ? row.itemsSold : '—'}
                      </td>
                      <td className="px-3 py-2 text-[11px] leading-relaxed">
                        {row.topLabels.length > 0
                          ? row.topLabels.map((l, idx) => (
                              <span key={`${row.weekKey}-${l.text}-${idx}`}>
                                {idx > 0 ? t('topLabelSep') : null}
                                {t('topLabelEntry', { label: l.text, count: l.count })}
                              </span>
                            ))
                          : t('emptyCell')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {flatLen > TABLE_PAGE ? (
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 dark:border-zinc-800">
            <span className="text-xs text-slate-500 tabular-nums">
              {t('page', { current: page + 1, total: pageCount })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
