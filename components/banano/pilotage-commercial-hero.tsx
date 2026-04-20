'use client';

import { memo, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Crown,
  Gift,
  Loader2,
  MessageCircle,
  Radio,
  Settings2,
  Sparkles,
  Ticket,
  TrendingUp,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { PilotageVipCard } from '@/components/banano/pilotage-vip-card';
import {
  PILOTAGE_DAILY_ACTIVITY_DAYS,
  type LoyaltyProgramKpiBundle,
  type PilotageDailyActivityRow,
  type PilotageLoyaltyProfitabilityMonth,
  type PilotageMonthlyFinancial,
  type SmartCardItem,
} from '@/lib/banano/pilotage/types';

type Props = {
  smartCards: SmartCardItem[];
  onRelaunchWhatsApp: () => void;
  relaunchBusy: boolean;
  monthlyFinancial: PilotageMonthlyFinancial | null;
  loyaltyProfitabilityMonth: PilotageLoyaltyProfitabilityMonth | null;
  loyaltyProgramKpis: LoyaltyProgramKpiBundle;
  hasTicketAmounts: boolean;
  dailyActivity: PilotageDailyActivityRow[];
  /** Vue dense (ex. bloc « tout-en-un » sous le deck Elite). */
  compact?: boolean;
};

function pickCard(cards: SmartCardItem[], id: SmartCardItem['id']): SmartCardItem | undefined {
  return cards.find((c) => c.id === id);
}

function formatPilotageEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function PilotageCommercialHeroInner({
  smartCards,
  onRelaunchWhatsApp,
  relaunchBusy,
  monthlyFinancial,
  loyaltyProfitabilityMonth,
  loyaltyProgramKpis,
  hasTicketAmounts,
  dailyActivity,
  compact = false,
}: Props) {
  const t = useTranslations('Dashboard.bananoOmnipresent');
  const locale = useLocale();

  const champion = pickCard(smartCards, 'champion');
  const vip = pickCard(smartCards, 'vip');
  const risk = pickCard(smartCards, 'risk');

  const sparkRows = useMemo(() => {
    const slice = dailyActivity.slice(0, PILOTAGE_DAILY_ACTIVITY_DAYS);
    return [...slice].reverse();
  }, [dailyActivity]);

  const maxSparkVisits = useMemo(() => Math.max(1, ...sparkRows.map((r) => r.visitCount)), [sparkRows]);

  return (
    <div className={compact ? 'space-y-3 sm:space-y-4' : 'space-y-5 sm:space-y-6'}>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-5">
        {/* Objectif mensuel + pulse fidélité + graphiques */}
        <div className={compact ? 'xl:col-span-7 space-y-3 sm:space-y-4' : 'xl:col-span-7 space-y-4 sm:space-y-5'}>
          {monthlyFinancial ? (
            <section
              className={`rounded-[14px] border border-zinc-600/50 bg-zinc-900/90 shadow-lg shadow-black/25 ring-1 ring-white/5 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}
              aria-label={t('overviewMonthlyGoalHeading')}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
                <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-200">
                  {t('overviewMonthlyGoalHeading')}
                </h4>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <span className="text-2xl font-bold tabular-nums text-zinc-50">
                  {formatPilotageEur(monthlyFinancial.revenueCents, locale)}
                </span>
                <span className="text-sm text-zinc-400">
                  / {formatPilotageEur(monthlyFinancial.goalCents, locale)}
                </span>
                <span className="text-xs font-semibold text-zinc-400 tabular-nums">
                  {monthlyFinancial.progressPercent}%
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-zinc-800 overflow-hidden mb-3"
                role="progressbar"
                aria-valuenow={monthlyFinancial.progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#2563eb]"
                  style={{ width: `${Math.min(100, monthlyFinancial.progressPercent)}%` }}
                />
              </div>
              <p
                className={`text-xs text-zinc-300 leading-relaxed mb-2 ${compact ? 'line-clamp-2' : ''}`}
              >
                {monthlyFinancial.coachLine}
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed border-t border-zinc-700/50 pt-2">
                {monthlyFinancial.forecastLine}
              </p>
              {monthlyFinancial.warCouncilLine ? (
                <p className="text-[11px] font-medium text-zinc-100 mt-2 rounded-lg bg-zinc-800/70 border border-zinc-600/40 px-2.5 py-2">
                  {monthlyFinancial.warCouncilLine}
                </p>
              ) : null}
            </section>
          ) : null}

          {loyaltyProfitabilityMonth ? (
            <section
              className={`rounded-[14px] border border-zinc-600/50 bg-zinc-900/90 shadow-lg shadow-black/25 ring-1 ring-white/5 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}
              aria-label={t('loyaltyProfitabilityTitle')}
            >
              <div className="flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4 text-amber-300 shrink-0" aria-hidden />
                <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-200">
                  {t('loyaltyProfitabilityTitle')}
                </h4>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:text-xs">
                <div className="flex justify-between gap-2 tabular-nums">
                  <dt className="text-zinc-400">{t('loyaltyProfitabilityGross')}</dt>
                  <dd className="font-semibold text-zinc-50">
                    {formatPilotageEur(loyaltyProfitabilityMonth.revenueGrossCents, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <dt className="text-zinc-400">{t('loyaltyProfitabilityRedeemedFixed')}</dt>
                  <dd className="font-semibold text-zinc-50">
                    {formatPilotageEur(loyaltyProfitabilityMonth.fixedVoucherRedemptionCents, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 tabular-nums sm:col-span-2">
                  <dt className="text-zinc-400">{t('loyaltyProfitabilityNet')}</dt>
                  <dd className="font-semibold text-emerald-300/95">
                    {formatPilotageEur(loyaltyProfitabilityMonth.revenueNetCents, locale)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <dt className="text-zinc-400">{t('loyaltyProfitabilityNewMembers')}</dt>
                  <dd className="font-semibold text-zinc-50">{loyaltyProfitabilityMonth.newMembersCount}</dd>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <dt className="text-zinc-400">{t('loyaltyProfitabilitySignupBon')}</dt>
                  <dd className="font-semibold text-zinc-50">
                    {loyaltyProfitabilityMonth.signupVouchersIssued}
                    {loyaltyProfitabilityMonth.signupIssuedFixedEuroCents > 0
                      ? ` · ${formatPilotageEur(loyaltyProfitabilityMonth.signupIssuedFixedEuroCents, locale)}`
                      : ''}
                  </dd>
                </div>
              </dl>
              <p className="text-[10px] text-zinc-400 mt-3 leading-relaxed border-t border-zinc-700/50 pt-2">
                {loyaltyProfitabilityMonth.revenueToFixedRedemptionRatio != null
                  ? t('loyaltyProfitabilityRoi', {
                      ratio: String(loyaltyProfitabilityMonth.revenueToFixedRedemptionRatio),
                    })
                  : t('loyaltyProfitabilityRoiEmpty')}
              </p>
            </section>
          ) : null}

          <section
            className={`rounded-[14px] border border-zinc-600/50 bg-zinc-900/90 shadow-lg shadow-black/25 ring-1 ring-white/5 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}
            aria-label={t('overviewLoyaltyPulseTitle')}
          >
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
              <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-200">
                {t('overviewLoyaltyPulseTitle')}
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(
                [
                  [loyaltyProgramKpis.day, t('loyaltyColDay')] as const,
                  [loyaltyProgramKpis.week, t('loyaltyColWeek')] as const,
                  [loyaltyProgramKpis.month, t('loyaltyColMonth')] as const,
                ] as const
              ).map(([kpi, colLabel], pulseIdx) => (
                <div
                  key={pulseIdx}
                  className="rounded-[14px] border border-zinc-600/40 bg-zinc-800/40 p-3 shadow-sm shadow-black/10"
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400 mb-2 truncate">
                    {colLabel}
                  </p>
                  <dl className="space-y-1.5 text-[11px] sm:text-xs">
                    <div className="flex justify-between gap-1 tabular-nums">
                      <dt className="text-zinc-400 truncate">{t('loyaltyPoints')}</dt>
                      <dd className="font-semibold text-zinc-50">{kpi.pointsDistributed}</dd>
                    </div>
                    <div className="flex justify-between gap-1 tabular-nums">
                      <dt className="text-zinc-400 truncate">{t('loyaltyStamps')}</dt>
                      <dd className="font-semibold text-zinc-50">{kpi.stampsEarned}</dd>
                    </div>
                    <div className="flex justify-between gap-1 tabular-nums">
                      <dt className="text-zinc-400 truncate">{t('loyaltyVouchers')}</dt>
                      <dd className="font-semibold text-zinc-50">{kpi.vouchersGenerated}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section
            className={`rounded-[14px] border border-zinc-600/50 bg-zinc-900/90 shadow-lg shadow-black/25 ring-1 ring-white/5 ${compact ? 'p-3' : 'p-4'}`}
            aria-label={t('overviewPassagesSparkTitle')}
          >
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-3">
              {t('overviewPassagesSparkTitle', { days: PILOTAGE_DAILY_ACTIVITY_DAYS })}
            </h4>
            <div
              className="flex items-end gap-0.5 sm:gap-1 h-24 px-0.5 max-w-xl"
              role="img"
              aria-label={t('overviewPassagesSparkTitle', { days: PILOTAGE_DAILY_ACTIVITY_DAYS })}
            >
              {sparkRows.map((row) => {
                const h = Math.max(6, (row.visitCount / maxSparkVisits) * 100);
                return (
                  <div key={row.dateKey} className="flex-1 min-w-0 flex flex-col justify-end group">
                    <div
                      className="w-full rounded-t bg-blue-500 hover:bg-blue-400 transition-colors"
                      style={{ height: `${h}%` }}
                      title={`${row.labelFr}: ${row.visitCount}`}
                    />
                  </div>
                );
              })}
            </div>
            {!hasTicketAmounts ? (
              <p className="text-[10px] text-zinc-400 mt-2 leading-snug">{t('noTicketAmounts')}</p>
            ) : null}
            {compact ? null : (
              <p className="text-[10px] text-zinc-500 mt-2">{t('overviewWeekdayInPdfHint')}</p>
            )}
          </section>
        </div>

        {/* Champions & relances */}
        <section
          className={`xl:col-span-5 rounded-[14px] border border-zinc-600/50 bg-zinc-900/90 shadow-lg shadow-black/25 ring-1 ring-white/5 flex flex-col min-h-0 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}
          aria-label={t('commercialHeroAria')}
        >
          <div className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 ${compact ? 'mb-3' : 'mb-4'}`}>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 text-[#2563eb]">
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
                <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-50">
                  {compact ? t('commercialHeroTitleCompact') : t('commercialHeroTitle')}
                </h3>
              </div>
              {compact ? null : (
                <p className="text-[11px] text-zinc-400 leading-snug">
                  {t('commercialHeroSubtitle')}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/whatsapp-review?tab=parametres"
              className="inline-flex items-center justify-center gap-2 min-h-[40px] shrink-0 rounded-[14px] border border-zinc-600 bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors shadow-sm shadow-black/20"
            >
              <Settings2 className="w-4 h-4 shrink-0" aria-hidden />
              {t('commercialHeroSettingsCta')}
            </Link>
          </div>

          <div className={`grid grid-cols-1 flex-1 min-h-0 ${compact ? 'gap-3' : 'gap-4'}`}>
            <div
              className={`rounded-xl border border-amber-200/80 dark:border-amber-900/35 bg-white/90 dark:bg-zinc-900/40 min-w-0 ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
            >
              {compact ? null : (
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <Crown className="w-4 h-4 shrink-0" aria-hidden />
                  <p className="text-[11px] font-bold uppercase tracking-wide">{t('commercialHeroChampionsTitle')}</p>
                </div>
              )}

              {champion ? (
                <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/15 p-3 space-y-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xl leading-none pt-0.5 shrink-0" aria-hidden>
                      {champion.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-50 leading-snug break-words">
                        {champion.title}
                      </p>
                      <p
                        className={`text-[11px] text-zinc-400 mt-1 leading-relaxed break-words ${compact ? 'line-clamp-3' : ''}`}
                      >
                        {champion.body}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {vip ? <PilotageVipCard card={vip} heroDark={false} compact={compact} /> : null}

              {!champion && !vip ? (
                <p className="text-xs text-zinc-400 py-2">{t('commercialHeroChampionsEmpty')}</p>
              ) : null}
            </div>

            <div
              className={`rounded-xl border border-rose-200/80 dark:border-rose-900/35 bg-white/90 dark:bg-zinc-900/40 min-w-0 flex flex-col flex-1 ${compact ? 'p-3 space-y-2.5' : 'p-4 space-y-3'}`}
            >
              {compact ? null : (
                <>
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                    <Radio className="w-4 h-4 shrink-0" aria-hidden />
                    <p className="text-[11px] font-bold uppercase tracking-wide">{t('commercialHeroRelancesTitle')}</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {t('commercialHeroRelancesHint')}
                  </p>
                </>
              )}

              {risk ? (
                <div className="rounded-xl border border-rose-200/60 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/20 p-3.5 space-y-2 flex-1">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-xl leading-none pt-0.5 shrink-0" aria-hidden>
                      {risk.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-50 leading-snug">{risk.title}</p>
                      <p
                        className={`text-[11px] text-zinc-300 mt-1.5 leading-relaxed break-words ${compact ? 'line-clamp-3' : ''}`}
                      >
                        {risk.body}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    {risk.whatsappRelaunch ? (
                      <button
                        type="button"
                        disabled={relaunchBusy}
                        onClick={onRelaunchWhatsApp}
                        className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#20bd5a] active:scale-[0.99] disabled:opacity-55 px-3 shadow-sm"
                      >
                        {relaunchBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <MessageCircle className="w-4 h-4 shrink-0" />
                        )}
                        {t('relaunchWhatsapp')}
                      </button>
                    ) : null}
                    {risk.href && risk.ctaLabel ? (
                      <Link
                        href={risk.href}
                        className="inline-flex items-center justify-center min-h-[44px] text-sm font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
                      >
                        {risk.ctaLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const PilotageCommercialHero = memo(PilotageCommercialHeroInner);
