'use client';

import { RefreshCw, Radio } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type {
  PilotageAtRiskMember,
  PilotageCashDeskMetrics,
  PilotageFeedWallItem,
} from '@/lib/banano/pilotage/operational-types';
import type { OmnipresentKpiBlock, TemporalViewKey } from '@/lib/banano/pilotage/types';

type Props = {
  establishmentName: string;
  periodLabel: string;
  cashDeskMetrics: PilotageCashDeskMetrics;
  temporal: Record<TemporalViewKey, OmnipresentKpiBlock>;
  atRiskMembers: PilotageAtRiskMember[];
  feedWall: PilotageFeedWallItem[];
  viewerUserId: string;
  merchantTimeZone: string;
  onRefreshPilotage: () => void;
};

function fmtEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function waLink(phoneE164: string, body: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (!digits) return '#';
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function PilotageEliteCommandSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-zinc-800 rounded-lg w-2/3" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="h-24 bg-zinc-800/80 rounded-xl" />
        <div className="h-24 bg-zinc-800/80 rounded-xl" />
        <div className="h-24 bg-zinc-800/80 rounded-xl" />
      </div>
      <div className="h-40 bg-zinc-800/60 rounded-xl" />
    </div>
  );
}

export function PilotageEliteCommandDeck(props: Props) {
  const t = useTranslations('Dashboard.bananoOmnipresent');
  const locale = useLocale();
  const {
    establishmentName,
    periodLabel,
    cashDeskMetrics,
    temporal,
    atRiskMembers,
    feedWall,
    onRefreshPilotage,
    merchantTimeZone,
    viewerUserId: _viewerUserId,
  } = props;

  const establishment = establishmentName.trim() || t('eliteEstablishmentFallback');
  const period = periodLabel.trim() || t('elitePeriodFallback');

  const loyalPct =
    cashDeskMetrics.walletRevenueCents > 0
      ? Math.round((cashDeskMetrics.loyalWalletRevenueCents / cashDeskMetrics.walletRevenueCents) * 100)
      : 0;
  const casualPct = Math.max(0, 100 - loyalPct);

  const day = temporal.day;

  return (
    <div className="space-y-5" aria-label={t('eliteDeckAria')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-200/90">{establishment}</p>
          <h3 className="text-lg font-bold text-zinc-50">{period}</h3>
          <p className="text-xs text-zinc-400 max-w-prose">{t('eliteDeckLead')}</p>
          <p className="text-[11px] text-zinc-500">{merchantTimeZone}</p>
        </div>
        <button
          type="button"
          onClick={() => onRefreshPilotage()}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          <RefreshCw className="w-4 h-4" aria-hidden />
          {t('opsLiveRefresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-zinc-700/80 bg-zinc-900/70 p-4 ring-1 ring-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('eliteKpiCa')}</p>
          <p className="text-xl font-bold tabular-nums text-zinc-50 mt-1">
            {fmtEur(cashDeskMetrics.walletRevenueCents, locale)}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">{t('eliteKpiCaHint')}</p>
        </div>
        <div className="rounded-[14px] border border-zinc-700/80 bg-zinc-900/70 p-4 ring-1 ring-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('eliteKpiFreq')}</p>
          <p className="text-xl font-bold tabular-nums text-zinc-50 mt-1">
            {cashDeskMetrics.walletVisitCount > 0 && cashDeskMetrics.uniqueWalletMembersWithVisit > 0
              ? (cashDeskMetrics.walletVisitCount / cashDeskMetrics.uniqueWalletMembersWithVisit).toLocaleString(
                  locale,
                  { maximumFractionDigits: 1 }
                )
              : '—'}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">
            {t('eliteKpiFreqHint', {
              visits: cashDeskMetrics.walletVisitCount,
              members: cashDeskMetrics.uniqueWalletMembersWithVisit,
            })}
          </p>
        </div>
        <div className="rounded-[14px] border border-zinc-700/80 bg-zinc-900/70 p-4 ring-1 ring-white/5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{t('eliteKpiBasket')}</p>
          <p className="text-xl font-bold tabular-nums text-zinc-50 mt-1">
            {cashDeskMetrics.avgBasketWalletCents != null
              ? fmtEur(cashDeskMetrics.avgBasketWalletCents, locale)
              : '—'}
          </p>
          <p className="text-[10px] text-zinc-500 mt-2">{t('eliteKpiBasketHint')}</p>
        </div>
      </div>

      <p className="text-xs text-zinc-400">
        {t('eliteRevenueSplitInline', { loyal: loyalPct, casual: casualPct })}
      </p>

      <div className="rounded-[14px] border border-zinc-700/70 bg-zinc-900/60 p-4 ring-1 ring-white/5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Radio className="w-4 h-4" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-wide text-zinc-200">{t('tabDay')}</span>
          <span className="text-[10px] text-zinc-500">{t('tabDayHint')}</span>
        </div>
        <p className="text-base font-semibold text-zinc-50">{day.headline}</p>
        <p className="text-sm text-zinc-300">{day.subline}</p>
        <p className="text-xs text-zinc-400">
          {t('insightLabelShort')} {day.insight}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[14px] border border-zinc-700/70 bg-zinc-900/60 p-4 ring-1 ring-white/5 space-y-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-200">{t('eliteAtRiskTitle')}</h4>
            <p className="text-[11px] text-zinc-500 mt-1">{t('eliteAtRiskSubtitle', { days: 35 })}</p>
          </div>
          {atRiskMembers.length === 0 ? (
            <p className="text-sm text-zinc-400">{t('eliteAtRiskEmpty')}</p>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {atRiskMembers.slice(0, 12).map((m) => {
                const prefill = t('eliteWaPrefill', { customer: m.displayLabel, establishment });
                const hrefWa = m.phoneE164 ? waLink(m.phoneE164, prefill) : null;
                return (
                  <li
                    key={m.memberId}
                    className="rounded-[12px] border border-zinc-700/50 bg-zinc-800/40 px-3 py-2 text-sm text-zinc-100"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{m.displayLabel}</p>
                        <p className="text-[11px] text-zinc-400">
                          {m.daysSinceVisit != null
                            ? t('eliteDaysSince', { n: m.daysSinceVisit })
                            : t('eliteLastVisitUnknown')}
                          {' · '}
                          {t('visitsCount', { n: m.lifetimeVisits })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={{
                            pathname: '/dashboard/whatsapp-review',
                            query: { member: m.memberId },
                          }}
                          className="text-[11px] font-semibold text-amber-300 hover:underline"
                        >
                          {t('eliteOpenFiche')}
                        </Link>
                        {hrefWa ? (
                          <a
                            href={hrefWa}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-emerald-400 hover:underline"
                          >
                            {t('eliteWhatsappCta')}
                          </a>
                        ) : (
                          <span className="text-[10px] text-zinc-500">{t('eliteNoPhone')}</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-[14px] border border-zinc-700/70 bg-zinc-900/60 p-4 ring-1 ring-white/5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-zinc-200">{t('eliteLiveTitle')}</h4>
              <p className="text-[11px] text-zinc-500">{t('eliteLiveSubtitle')}</p>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400/90">{t('eliteLiveRealtimeOn')}</span>
          </div>
          {feedWall.length === 0 ? (
            <p className="text-sm text-zinc-400">{t('opsLiveEmpty')}</p>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1 text-sm text-zinc-100">
              {feedWall.map((row) => (
                <li
                  key={row.id}
                  className="rounded-[12px] border border-zinc-700/45 bg-zinc-800/35 px-3 py-2 leading-snug"
                >
                  {row.summaryLine}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
