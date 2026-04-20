'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FEATURES, getRequiredPlanDisplayName } from '@/lib/feature-gate';
import type { ComptaBananoMonthlyPayload } from '@/lib/banano/compta-banano-monthly';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

function defaultYearMonth(): { year: number; month: number } {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
}

export function BananoComptaExpertSection() {
  const t = useTranslations('Dashboard.bananoComptaExpert');
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
  const initial = useMemo(() => defaultYearMonth(), []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [data, setData] = useState<ComptaBananoMonthlyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const monthOptions = useMemo(() => {
    const out: { y: number; m: number; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 36; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const label = d.toLocaleDateString(intlTag, { month: 'long', year: 'numeric' });
      out.push({ y, m, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return out;
  }, [intlTag]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/banano/compta/voucher-summary?year=${year}&month=${month}`);
      const json = (await res.json()) as ComptaBananoMonthlyPayload & { error?: string; feature?: string };
      if (res.status === 403) {
        setLocked(true);
        setData(null);
        return;
      }
      setLocked(false);
      if (!res.ok) throw new Error(json.error ?? t('errGeneric'));
      if ('loyalty' in json && 'staff' in json) {
        setData(json as ComptaBananoMonthlyPayload);
      } else {
        throw new Error(t('errInvalidResponse'));
      }
    } catch (e) {
      setData(null);
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setLoading(false);
    }
  }, [year, month, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pdfHref = `/api/banano/compta/voucher-summary/pdf?year=${year}&month=${month}`;
  const csvHref = `/api/banano/compta/voucher-summary/csv?year=${year}&month=${month}`;

  if (locked) {
    return (
      <section
        className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/25 p-4 sm:p-5 shadow-sm space-y-2"
        aria-label={t('ariaLocked')}
      >
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <Calculator className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-bold uppercase tracking-wide">{t('lockedTitle')}</h3>
        </div>
        <p className="text-sm text-amber-950/90 dark:text-amber-100/90 leading-relaxed">
          {t('lockedBody', { plan: getRequiredPlanDisplayName(FEATURES.COMPTA_BANANO_EXPERT) })}
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm space-y-4"
      aria-label={t('ariaMain')}
    >
      <div className="flex items-center gap-2 text-[#2563eb]">
        <Calculator className="w-5 h-5 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">{t('title')}</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('intro')}</p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {t('monthLabel')}
          <select
            value={`${year}-${month}`}
            onChange={(e) => {
              const [ys, ms] = e.target.value.split('-');
              setYear(parseInt(ys!, 10));
              setMonth(parseInt(ms!, 10));
            }}
            className="mt-1 block min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm ml-0"
          >
            {monthOptions.map((o) => (
              <option key={`${o.y}-${o.m}`} value={`${o.y}-${o.m}`}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 mt-6 sm:mt-0 sm:ml-auto">
          <a
            href={pdfHref}
            className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border border-[#2563eb]/40 bg-[#2563eb]/5 text-sm font-semibold text-[#2563eb] hover:bg-[#2563eb]/10"
          >
            <Download className="w-4 h-4 shrink-0" />
            {t('pdfPro')}
          </a>
          <a
            href={csvHref}
            className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-900"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            {t('csvCompta')}
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          {t('loading')}
        </div>
      ) : data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
              {t('loyaltyTitle')}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {fmtEur(data.loyalty.totalFixedEuroCents)}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {t('loyaltySub', {
                percentCount: data.loyalty.percentVoucherCount,
                labelOnlyCount: data.loyalty.labelOnlyVoucherCount,
                redemptions: data.loyalty.totalRedemptions,
              })}
            </p>
          </div>
          <div className="rounded-xl border border-violet-200/80 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/20 p-4 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-100">
              {t('staffTitle')}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
              {fmtEur(data.staff.totalDebitedCents)}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
              {t('staffSub', { debitEventCount: data.staff.debitEventCount })}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">{t('noData')}</p>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-zinc-800 pt-3">
        {t('footnote')}
      </p>
    </section>
  );
}
