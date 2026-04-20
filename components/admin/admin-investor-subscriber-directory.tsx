'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Search, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { InvestorUnitEconomics, SubscriberEconomicsRow } from '@/lib/admin/investor-metrics';
import {
  degressiveSeatMonthlyPricesEur,
  PLAN_BASE_PRICES_EUR,
  subscriberGroupMrrEurDegressive,
  type PlanSlug,
} from '@/config/pricing';
import { AdminHelpPastille } from '@/components/admin/admin-help-pastille';

const PAGE_SIZE = 8;

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type InvSubscriberT = (
  key: string,
  values?: Record<string, string | number | boolean | Date | null | undefined>,
) => string;

/** Libellés compréhensibles + phrase d’aide pour infobulle (badge). */
function matchExplain(row: SubscriberEconomicsRow, t: InvSubscriberT): {
  short: string;
  title: string;
  className: string;
} {
  switch (row.profileMatch) {
    case 'stripe_subscription_id':
      return {
        short: t('matchStripeSubShort'),
        title: t('matchStripeSubTitle'),
        className: 'text-emerald-300/95 bg-emerald-500/15 border-emerald-500/35',
      };
    case 'stripe_customer_id':
      return {
        short: t('matchStripeCustomerShort'),
        title: t('matchStripeCustomerTitle'),
        className: 'text-sky-300/95 bg-sky-500/15 border-sky-500/35',
      };
    case 'email':
      return {
        short: t('matchEmailShort'),
        title: t('matchEmailTitle'),
        className: 'text-violet-300/95 bg-violet-500/15 border-violet-500/35',
      };
    default:
      return {
        short: t('matchNoProfileShort'),
        title: t('matchNoProfileTitle'),
        className: 'text-amber-200/90 bg-amber-500/12 border-amber-500/30',
      };
  }
}

function normalizeEmail(s: string | null | undefined): string | null {
  const t = s?.trim().toLowerCase();
  return t || null;
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/** Même payeur Stripe : priorité au client `cus_`, sinon e-mail de facturation / fiche. */
function payerGroupKey(r: SubscriberEconomicsRow): string {
  if (r.stripeCustomerId?.trim()) return `cus:${r.stripeCustomerId.trim()}`;
  const bill = normalizeEmail(r.customerEmail) ?? normalizeEmail(r.email);
  if (bill) return `mail:${bill}`;
  return `sub:${r.stripeSubscriptionId}`;
}

type PayerSubscriptionGroup = {
  key: string;
  rows: SubscriberEconomicsRow[];
};

function groupSubscriptions(rows: SubscriberEconomicsRow[]): PayerSubscriptionGroup[] {
  const map = new Map<string, SubscriberEconomicsRow[]>();
  for (const r of rows) {
    const k = payerGroupKey(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const groups: PayerSubscriptionGroup[] = [...map.entries()].map(([key, list]) => {
    list.sort((a, b) => b.mrrEur - a.mrrEur);
    return { key, rows: list };
  });
  groups.sort((a, b) => {
    const sa = a.rows.reduce((s, x) => s + x.mrrEur, 0);
    const sb = b.rows.reduce((s, x) => s + x.mrrEur, 0);
    return sb - sa;
  });
  return groups;
}

function pickPrimaryRow(rows: SubscriberEconomicsRow[]): SubscriberEconomicsRow {
  const byMrr = [...rows].sort((a, b) => b.mrrEur - a.mrrEur);
  const withProf = byMrr.find((r) => r.profileId);
  return withProf ?? byMrr[0];
}

function splitGivenFamily(fullName: string | null | undefined): { given: string; family: string | null } | null {
  const t = fullName?.trim();
  if (!t) return null;
  const i = t.indexOf(' ');
  if (i === -1) return { given: t, family: null };
  return { given: t.slice(0, i), family: t.slice(i + 1).trim() || null };
}

function PayerCell({
  row,
  nSubscriptions,
  mrrWarning,
}: {
  row: SubscriberEconomicsRow;
  nSubscriptions: number;
  mrrWarning: boolean;
}) {
  const t = useTranslations('Admin.investorSubscriberDirectory');
  const est = row.establishmentName?.trim();
  const parts = splitGivenFamily(row.fullName);
  const headline = est || row.displayLabel;
  const given = parts?.given ?? '—';
  const family = parts?.family ?? '—';

  return (
    <div className="flex min-w-[10rem] max-w-[15rem] flex-col gap-1.5">
      <div className="min-w-0 space-y-1">
        <p className="break-words font-medium leading-snug text-zinc-100">{headline}</p>
        <div className="space-y-0.5 text-left text-[10px] text-zinc-500">
          <p className="break-words leading-snug">
            <span className="text-zinc-600">{t('labelGivenName')}</span>{' '}
            <span className="font-medium text-zinc-400">{given}</span>
          </p>
          <p className="break-words leading-snug">
            <span className="text-zinc-600">{t('labelFamilyName')}</span>{' '}
            <span className="font-medium text-zinc-400">{family}</span>
          </p>
        </div>
      </div>
      {nSubscriptions > 1 ? (
        <span className="inline-flex shrink-0 self-start rounded-md border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200/95">
          {t('establishmentsBadge', { count: nSubscriptions })}
        </span>
      ) : null}
      {mrrWarning ? (
        <span className="inline-block rounded border border-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-200/85">
          {t('mrrZeroWarning')}
        </span>
      ) : null}
    </div>
  );
}

function formatSeatEuros(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

/** Libellé court du plan (sans prix), pour enchaîner les paliers lisiblement. */
function planShortLabel(slug: PlanSlug): string {
  if (slug === 'vision') return 'Vision';
  if (slug === 'pulse') return 'Pulse';
  return 'Zenith';
}

type PlanStackLine = { text: string; title: string };

function planStackLines(rows: SubscriberEconomicsRow[], tr: InvSubscriberT): PlanStackLine[] {
  if (rows.length <= 1) {
    return [{ text: rows[0]?.planLabel ?? '—', title: '' }];
  }

  const out: PlanStackLine[] = [];
  const slugless = rows.filter((r) => !r.planSlug);
  const bucketCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.planSlug) continue;
    const key = `${r.planSlug}:${r.billingAnnual ? 'a' : 'm'}`;
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of [...bucketCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sep = key.lastIndexOf(':');
    const slug = key.slice(0, sep) as PlanSlug;
    const annual = key.slice(sep + 1) === 'a';
    const base = PLAN_BASE_PRICES_EUR[slug];
    const seats = degressiveSeatMonthlyPricesEur(base, count);
    const chain = seats.map((e) => formatSeatEuros(e)).join(' + ');
    const name = planShortLabel(slug);
    const annualSuffix = annual ? tr('planStackAnnualSuffix') : '';
    out.push({
      text: tr('planStackLineText', {
        name,
        count: String(count),
        annualSuffix,
        chain,
      }),
      title: annual
        ? tr('planStackTitleAnnual', { name, chain })
        : tr('planStackTitleMonthly', { name }),
    });
  }

  for (const r of slugless) {
    out.push({
      text: tr('planStackUnknownText', { planLabel: r.planLabel }),
      title: tr('planStackUnknownTitle'),
    });
  }

  return out.length > 0 ? out : [{ text: '—', title: '' }];
}

function statusSummary(rows: SubscriberEconomicsRow[]): string {
  const uniq = [...new Set(rows.map((r) => r.subscriptionStatus))].sort();
  return uniq.join(' · ');
}

function groupMatchExplain(
  rows: SubscriberEconomicsRow[],
  t: InvSubscriberT,
): ReturnType<typeof matchExplain> {
  const first = rows[0]?.profileMatch;
  if (rows.length > 0 && rows.every((r) => r.profileMatch === first)) {
    return matchExplain(rows[0], t);
  }
  return {
    short: t('matchMixedShort'),
    title: t('matchMixedTitle'),
    className: 'text-zinc-200/95 bg-zinc-600/20 border-zinc-500/35',
  };
}

function EmailContactCell({ row }: { row: SubscriberEconomicsRow }) {
  const t = useTranslations('Admin.investorSubscriberDirectory');
  const prof = row.email?.trim() || null;
  const stripe = row.customerEmail?.trim() || null;
  const profN = normalizeEmail(prof);
  const stripeN = normalizeEmail(stripe);

  if (!prof && !stripe) {
    return <span className="text-zinc-600">—</span>;
  }

  if (profN && stripeN && profN === stripeN) {
    return (
      <p className="text-zinc-200 truncate font-mono text-[11px]" title={prof ?? undefined}>
        {prof}
      </p>
    );
  }

  if (profN && stripeN && profN !== stripeN) {
    return (
      <div
        className="space-y-1 min-w-0"
        title={t('billingVsAppTooltip', { stripe: String(stripe), prof: String(prof) })}
      >
        <p className="font-mono text-zinc-200 truncate text-[11px]">{stripe}</p>
        <p className="font-mono text-zinc-500 truncate text-[10px]">{prof}</p>
      </div>
    );
  }

  const only = stripe ?? prof;
  return (
    <p className="text-zinc-200 truncate font-mono text-[11px]" title={only ?? undefined}>
      {only}
    </p>
  );
}

function searchHaystack(row: SubscriberEconomicsRow): string {
  return [
    row.displayLabel,
    row.fullName ?? '',
    row.establishmentName ?? '',
    row.email ?? '',
    row.customerEmail ?? '',
    row.phone ?? '',
    row.stripeCustomerId,
    row.stripeSubscriptionId,
    row.planLabel,
    row.subscriptionStatus,
  ]
    .join(' ')
    .toLowerCase();
}

function rowMatchesQuery(row: SubscriberEconomicsRow, q: string): boolean {
  if (!q) return true;
  if (searchHaystack(row).includes(q)) return true;
  const qDigits = digitsOnly(q);
  if (qDigits.length >= 3 && row.phone) {
    if (digitsOnly(row.phone).includes(qDigits)) return true;
  }
  return false;
}

type Props = { unit: InvestorUnitEconomics };

export function AdminInvestorSubscriberDirectory({ unit }: Props) {
  const locale = useLocale();
  const t = useTranslations('Admin.investorSubscriberDirectory');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const q = query.trim().toLowerCase();
  const groupedAll = useMemo(() => groupSubscriptions(unit.rows), [unit.rows]);
  const payerTotalCount = groupedAll.length;
  const establishmentCount = unit.rows.length;
  const filteredGroups = useMemo(() => {
    if (!q) return groupedAll;
    return groupedAll.filter((g) => g.rows.some((r) => rowMatchesQuery(r, q)));
  }, [groupedAll, q]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageGroups = filteredGroups.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const adminClientsHref = (focus: string) => {
    const enc = encodeURIComponent(focus.trim());
    return `/${locale}/dashboard/admin?clients_q=${enc}#admin-clients`;
  };

  const focusToken = (row: SubscriberEconomicsRow) =>
    row.email?.trim() ||
    row.customerEmail?.trim() ||
    row.displayLabel.trim() ||
    row.stripeCustomerId ||
    row.stripeSubscriptionId;

  return (
    <div className="rounded-2xl border border-zinc-700/90 bg-zinc-900/35 p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Users className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wide flex items-center flex-wrap gap-x-1">
              {t('sectionTitle')}
              <AdminHelpPastille text={t('sectionHelpPastille')} />
            </h3>
            <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono text-zinc-400">
              <span
                className="rounded-md border border-zinc-700/80 bg-zinc-950/50 px-2 py-0.5"
                title={t('establishmentStripeTitle')}
              >
                {t('establishmentStripe', { count: establishmentCount })}
                {unit.totals.trialingCount
                  ? t('establishmentStripeTrialingSuffix', {
                      activeCount: unit.totals.activeCount,
                      trialingCount: unit.totals.trialingCount,
                    })
                  : ''}
              </span>
              <span
                className="rounded-md border border-zinc-700/80 bg-zinc-950/50 px-2 py-0.5"
                title={t('payerGroupTitle')}
              >
                {t('payerGroupLine', { count: payerTotalCount })}
              </span>
              <span className="rounded-md border border-zinc-700/80 bg-zinc-950/50 px-2 py-0.5">
                {t('avgMrrPerSubChip', { amount: formatEur(unit.totals.avgMrrPerSubEur) })}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 ${
                  unit.totals.unmatchedStripeSubs === 0
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-100/90'
                }`}
              >
                {unit.totals.unmatchedStripeSubs === 0
                  ? t('unmatchedAllLinked')
                  : t('unmatchedSome', { count: unit.totals.unmatchedStripeSubs })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500/35"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800/90">
        <table className="min-w-[920px] w-full text-left text-[11px]">
          <thead className="bg-zinc-950/80 text-zinc-500 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 font-medium align-bottom">
                <span className="inline-flex items-center">
                  {t('colPayer')}
                  <AdminHelpPastille text={t('helpClientCol')} />
                </span>
              </th>
              <th className="px-3 py-2 font-medium align-bottom min-w-[180px]">
                <span className="inline-flex items-center">
                  {t('colEmail')}
                  <AdminHelpPastille text={t('helpEmailCol')} />
                </span>
              </th>
              <th className="px-3 py-2 font-medium align-bottom whitespace-normal max-w-[120px]">
                <span className="inline-flex items-start">
                  {t('colProfileLink')}
                  <AdminHelpPastille text={t('helpLinkCol')} />
                </span>
              </th>
              <th className="px-3 py-2 font-medium align-bottom">{t('colPlan')}</th>
              <th className="px-3 py-2 font-medium align-bottom">{t('colStatus')}</th>
              <th className="px-3 py-2 font-medium text-right align-bottom">{t('colMrr')}</th>
              <th className="px-3 py-2 font-medium text-right align-bottom">
                <span className="inline-flex items-center justify-end w-full">
                  {t('colAdmin')}
                  <AdminHelpPastille text={t('helpAdminCol')} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {pageGroups.map((g) => {
              const primary = pickPrimaryRow(g.rows);
              const badge = groupMatchExplain(g.rows, t);
              const focus = focusToken(primary);
              const n = g.rows.length;
              const totalMrr = subscriberGroupMrrEurDegressive(
                g.rows.map((r) => ({
                  planSlug: r.planSlug,
                  billingAnnual: r.billingAnnual,
                  mrrEur: r.mrrEur,
                }))
              );
              return (
                <tr key={g.key} className="bg-zinc-900/20 hover:bg-zinc-900/45">
                  <td
                    className="px-3 py-2.5 text-zinc-200 align-top"
                    title={n > 1 ? g.rows.map((r) => r.displayLabel).join(' · ') : undefined}
                  >
                    <PayerCell row={primary} nSubscriptions={n} mrrWarning={totalMrr < 0.01} />
                  </td>
                  <td className="px-3 py-2.5 align-top border-l border-zinc-800/40">
                    <EmailContactCell row={primary} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <span
                      className={`inline-flex max-w-[12rem] rounded-md border px-2 py-1 text-[10px] font-medium leading-snug ${badge.className}`}
                      title={badge.title}
                    >
                      {badge.short}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-300 align-top">
                    {(() => {
                      const lines = planStackLines(g.rows, t);
                      if (lines.length === 1 && !lines[0].title) {
                        return <span className="whitespace-nowrap">{lines[0].text}</span>;
                      }
                      return (
                        <div className="space-y-1 max-w-[min(100%,320px)]">
                          {lines.map((line, i) => (
                            <p
                              key={`${line.text}-${i}`}
                              className="leading-snug whitespace-normal text-[11px]"
                              title={line.title || undefined}
                            >
                              {line.text}
                            </p>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500 font-mono align-top capitalize">{statusSummary(g.rows)}</td>
                  <td
                    className="px-3 py-2.5 text-right tabular-nums text-zinc-200 align-top"
                    title={n > 1 ? t('groupMrrTooltip') : undefined}
                  >
                    {totalMrr >= 0.01 ? formatEur(totalMrr) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right align-top">
                    <a
                      href={adminClientsHref(focus)}
                      className="inline-flex items-center justify-end gap-1 rounded-lg border border-zinc-600 px-2 py-1 text-zinc-300 hover:bg-zinc-800 text-[10px] ml-auto"
                      title={t('findInClientsTitle', {
                        snippet: `${focus.slice(0, 48)}${focus.length > 48 ? '…' : ''}`,
                      })}
                    >
                      {t('findInClients')}
                      <ExternalLink className="w-3 h-3 opacity-70 shrink-0" aria-hidden />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-zinc-500">
        <p>
          {t('footerSummary', {
            payerCount: filteredGroups.length,
            estabCount: unit.rows.length,
            filterTag: q ? t('footerFilteredTag') : '',
            pageNum: safePage + 1,
            pageTotal: pageCount,
          })}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {t('paginationPrev')}
          </button>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
          >
            {t('paginationNext')}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
