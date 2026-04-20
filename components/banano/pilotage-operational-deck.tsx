'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type {
  PilotageAutomationStatusSnapshot,
  PilotageCalendarMonthBundle,
  PilotageCashDeskMetrics,
} from '@/lib/banano/pilotage/operational-types';

type Props = {
  cashDeskMetrics: PilotageCashDeskMetrics;
  calendarMonth: PilotageCalendarMonthBundle;
  automationStatus: PilotageAutomationStatusSnapshot;
  hasTicketAmounts: boolean;
  calendarYear: number;
  calendarMonthNum: number;
  onCalendarChange: (year: number, month: number) => void;
};

function fmtEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function PilotageOperationalDeck(props: Props) {
  const t = useTranslations('Dashboard.bananoOmnipresent');
  const locale = useLocale();
  const {
    cashDeskMetrics,
    calendarMonth,
    automationStatus,
    hasTicketAmounts,
    calendarYear,
    calendarMonthNum,
    onCalendarChange,
  } = props;

  const [mode, setMode] = useState<'visits' | 'stamps'>('visits');

  const weekNarrowLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(d);
    });
  }, [locale]);

  const maxVal = useMemo(() => {
    let m = 1;
    for (const c of calendarMonth.cells) {
      if (!c.isInMonth) continue;
      const v = mode === 'visits' ? c.visitCount : c.stampCount;
      if (v > m) m = v;
    }
    return m;
  }, [calendarMonth.cells, mode]);

  function shiftMonth(delta: number) {
    const d = new Date(calendarYear, calendarMonthNum - 1 + delta, 1);
    onCalendarChange(d.getFullYear(), d.getMonth() + 1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-4 ring-1 ring-white/5">
        <div>
          <h3 className="text-sm font-bold text-zinc-50 uppercase tracking-wide">{t('opsAutoTitle')}</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('opsAutoSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-zinc-100">
          <div className="rounded-[12px] border border-zinc-700/50 bg-zinc-800/40 p-3">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{t('opsAutoBirthday')}</p>
            <p className="text-lg font-bold tabular-nums mt-1">{automationStatus.birthdayMessagesSentToday}</p>
            <p className="text-[10px] text-zinc-500 mt-1">{t('opsAutoBirthdayHint')}</p>
          </div>
          <div className="rounded-[12px] border border-zinc-700/50 bg-zinc-800/40 p-3">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{t('opsAutoPush')}</p>
            <p className="text-lg font-bold tabular-nums mt-1">{fmtEur(automationStatus.pushAttributedRevenueMonthCents, locale)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">
              {t('opsAutoPushSends', { n: automationStatus.pushSendsCountMonth })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-300">{t('opsAutoRelancesDetailTitle')}</p>
          <p className="text-[11px] text-zinc-500">{t('opsAutoRelancesDetailIntro')}</p>
          <ul className="space-y-1.5 text-xs text-zinc-200">
            <li>
              {t('opsAutoRuleLost')}:{' '}
              {automationStatus.relanceRulesEnabled.lost_client ? t('opsAutoStateOn') : t('opsAutoStateOff')} —{' '}
              {t('opsAutoSendsThisMonth', { n: automationStatus.relanceSendsMonth.lost_client })}
            </li>
            <li>
              {t('opsAutoRuleWelcome')}:{' '}
              {automationStatus.relanceRulesEnabled.new_client_welcome ? t('opsAutoStateOn') : t('opsAutoStateOff')}{' '}
              — {t('opsAutoSendsThisMonth', { n: automationStatus.relanceSendsMonth.new_client_welcome })}
            </li>
            <li>
              {t('opsAutoRuleBirthday')}:{' '}
              {automationStatus.relanceRulesEnabled.birthday ? t('opsAutoStateOn') : t('opsAutoStateOff')} —{' '}
              {t('opsAutoSendsThisMonth', { n: automationStatus.relanceSendsMonth.birthday })}
            </li>
            <li>
              {t('opsAutoRuleVip')}:{' '}
              {automationStatus.relanceRulesEnabled.vip_of_month ? t('opsAutoStateOn') : t('opsAutoStateOff')} —{' '}
              {t('opsAutoSendsThisMonth', { n: automationStatus.relanceSendsMonth.vip_of_month })}
            </li>
          </ul>
        </div>

        {!hasTicketAmounts ? (
          <p className="text-xs text-amber-200/90 bg-amber-950/20 border border-amber-800/40 rounded-[12px] p-3">
            {t('noTicketAmounts')}
          </p>
        ) : null}

        <div className="rounded-[12px] border border-zinc-700/50 bg-zinc-800/30 p-3 text-xs text-zinc-300 space-y-1">
          <p className="font-semibold text-zinc-200">{t('opsLiveTitle')}</p>
          <p>{t('opsLiveSubtitle')}</p>
          <p className="tabular-nums text-zinc-100">
            {t('eliteKpiCa')}: {fmtEur(cashDeskMetrics.walletRevenueCents, locale)} · {t('eliteKpiFreqHint', {
              visits: cashDeskMetrics.walletVisitCount,
              members: cashDeskMetrics.uniqueWalletMembersWithVisit,
            })}
          </p>
        </div>
      </section>

      <section className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-4 ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-50 uppercase tracking-wide">{t('opsCalendarTitle')}</h3>
            <p className="text-xs text-zinc-400 mt-1">{t('opsCalendarSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex items-center justify-center min-h-[40px] w-10 rounded-[12px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              aria-label={t('opsCalendarPrev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="inline-flex items-center justify-center min-h-[40px] w-10 rounded-[12px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
              aria-label={t('opsCalendarNext')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMode('visits')}
            className={`min-h-[36px] px-3 rounded-[12px] border ${
              mode === 'visits'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                : 'border-zinc-600 bg-zinc-800 text-zinc-300'
            }`}
          >
            {t('opsCalendarVisits')}
          </button>
          <button
            type="button"
            onClick={() => setMode('stamps')}
            className={`min-h-[36px] px-3 rounded-[12px] border ${
              mode === 'stamps'
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
                : 'border-zinc-600 bg-zinc-800 text-zinc-300'
            }`}
          >
            {t('opsCalendarStamps')}
          </button>
        </div>

        <p className="text-[11px] text-zinc-500">
          {t('opsCalendarLegend', { mode: mode === 'visits' ? t('opsCalendarVisits') : t('opsCalendarStamps') })}
        </p>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-500 uppercase tracking-wide">
          {weekNarrowLabels.map((d, i) => (
            <div key={`dow-${i}`} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarMonth.cells.map((c) => {
            const val = mode === 'visits' ? c.visitCount : c.stampCount;
            const intensity = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
            const bg =
              !c.isInMonth
                ? 'bg-zinc-900/40 text-zinc-600 border-zinc-800'
                : val < 1
                  ? 'bg-zinc-800/40 text-zinc-400 border-zinc-700/50'
                  : intensity > 66
                    ? 'bg-emerald-600/25 text-emerald-100 border-emerald-500/40'
                    : intensity > 33
                      ? 'bg-emerald-600/15 text-zinc-100 border-emerald-500/25'
                      : 'bg-zinc-800/60 text-zinc-200 border-zinc-600/50';
            return (
              <div
                key={c.dateKey}
                title={`${c.dateKey}: ${val}`}
                className={`rounded-[10px] border min-h-[44px] flex flex-col items-center justify-center text-[11px] font-semibold tabular-nums ${bg}`}
              >
                <span className="text-[10px] opacity-80">{c.dayNum}</span>
                <span>{c.isInMonth ? val : ''}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
