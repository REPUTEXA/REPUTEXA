/**
 * Métriques investisseur (admin) — Stripe balance + MRR, agrégats factures,
 * mix de plans, cohortes profils, burn OpenAI (API Costs si disponible) + Resend (estimation env).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-client';
import { getPlanSlugFromSubscription } from '@/lib/stripe-subscription';
import type { PlanSlug } from '@/config/pricing';
import {
  computeExecutiveProjection,
  type ExecutiveProjection,
} from '@/lib/admin/investor-executive-projection';
import {
  countCanceledSubscriptionsSince,
  listSubscriptionsForMrr,
  sumSubscriptionMonthlyEur,
} from '@/lib/admin/stripe-mrr-helpers';
import {
  computeSaasKpisFields,
  countNewMerchantProfilesLast30d,
  type SaasKpisPayload,
} from '@/lib/admin/saas-kpis';
import { formatPlanAmountForLocale } from '@/lib/i18n/pricing-message-format';

export type BurnGrowthPoint = { m: string; burn: number; growth: number };
export type CohortPoint = { cohorte: string; rétention: number; signed: number; retained: number };

/** Nom du champ agrégat « rétention » dans les séries cohorte (données serveur). */
export const COHORT_RETENTION_FIELD = 'rétention' as const;
export type PlanSlice = { name: string; pct: number; count: number; fill: string };

/** Une ligne d’abonnement Stripe rapprochée d’un profil — coûts variables répartis au prorata du MRR. */
export type SubscriberEconomicsRow = {
  profileId: string | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  /** E-mail facturation Stripe (customer) quand expansé. */
  customerEmail: string | null;
  /** Comment le profil a été rapproché. */
  profileMatch: 'stripe_subscription_id' | 'stripe_customer_id' | 'email' | 'none';
  displayLabel: string;
  email: string | null;
  /** Champs profil (recherche admin / affichage). */
  fullName: string | null;
  establishmentName: string | null;
  phone: string | null;
  planSlug: PlanSlug | null;
  planLabel: string;
  /** Facturation au cycle annuel Stripe (équivalent mensuel -20 % sur stack). */
  billingAnnual: boolean;
  subscriptionStatus: string;
  mrrEur: number;
  /** Part du MRR total (%) — pour comprendre qui « porte » le chiffre. */
  pctOfMrr: number;
  /** Estimation : (MRR ligne / MRR total) × coûts variables mois (OpenAI + Resend). */
  allocatedVariableCostEur: number;
  /** MRR − coût alloué (marge contribution simplifiée, hors frais Stripe détaillés / fixes). */
  estimatedContributionEur: number;
  /** (contribution / MRR) × 100 si MRR ligne > 0. */
  estimatedMarginPct: number | null;
};

export type InvestorUnitEconomics = {
  /** Texte pédagogique affiché tel quel dans l’admin. */
  explainSimpleFr: string;
  methodNoteFr: string;
  rows: SubscriberEconomicsRow[];
  totals: {
    mrrEur: number;
    variableCostsEur: number;
    contributionAfterVariableEur: number;
    /** (contribution / MRR) × 100 */
    contributionMarginPct: number | null;
    /** (coûts variables / MRR) × 100 */
    variableCostRatioPct: number | null;
    avgMrrPerSubEur: number;
    activeCount: number;
    trialingCount: number;
    unmatchedStripeSubs: number;
  };
};

export type PaidRevenueMonthRow = {
  monthKey: string;
  label: string;
  paidEur: number;
};

export type PaidRevenueHistoryMeta = {
  /** Fenêtre demandée côté Stripe (factures payées agrégées). */
  horizonMonths: number;
  monthsWithData: number;
  firstMonthKey: string | null;
  lastMonthKey: string | null;
  /** Somme des montants mensuels listés (pas total vie si mois sans facture). */
  sumPaidEurInSeries: number;
};

export type InvestorMetricsPayload = {
  generatedAt: string;
  stripe: {
    availableEur: number;
    pendingEur: number;
    totalCashEur: number;
    mrrEur: number;
    activeSubscriptions: number;
  };
  burnOps: {
    openaiEurMonth: number | null;
    resendEurMonth: number;
    totalEurMonth: number;
    openaiError?: string;
  };
  planMix: PlanSlice[];
  burnVsGrowth: BurnGrowthPoint[];
  /** Dernières cohortes affichées graphique (8 mois). */
  cohorts: CohortPoint[];
  /** Cohortes étendues pour analyse / copilot (jusqu’à 36 mois d’inscription). */
  cohortsExtended: CohortPoint[];
  /** CA factures Stripe payées par mois civil UTC — série complète remontée en base. */
  paidRevenueHistory: PaidRevenueMonthRow[];
  paidRevenueHistoryMeta: PaidRevenueHistoryMeta;
  /** Profils marchands chargés (hors admin) — utile au copilot. */
  nonAdminProfilesLoaded: number;
  /** Projection indicative data-room (ARR & momentum facturation). */
  executiveProjection: ExecutiveProjection;
  /** Rentabilité simplifiée par client (estimation — pas de coût réel mesuré par utilisateur). */
  unitEconomics: InvestorUnitEconomics;
  /** Churn logo, ARPU, LTV et CPA indicatifs (même définitions que le bandeau admin). */
  saasKpis: SaasKpisPayload;
};

const PLAN_COLORS: Record<PlanSlug, string> = {
  vision: '#64748b',
  pulse: '#3b82f6',
  zenith: '#a855f7',
};

function planStripeLabel(slug: PlanSlug): string {
  const name = slug === 'zenith' ? 'Zenith' : slug.charAt(0).toUpperCase() + slug.slice(1);
  return `${name} · ${formatPlanAmountForLocale('fr', slug)}`;
}

const PLAN_LABELS: Record<PlanSlug, string> = {
  vision: planStripeLabel('vision'),
  pulse: planStripeLabel('pulse'),
  zenith: planStripeLabel('zenith'),
};

/** Historique factures payées remonté pour le dossier copilot (Stripe list pagination). */
const PAID_INVOICE_HISTORY_MONTHS = 48;
const INVOICE_LIST_MAX_PAGES = 160;

const MOIS_COURTS = ['Janv', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

function monthKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MOIS_COURTS[m - 1] ?? m} ${String(y).slice(-2)}`;
}

function lastNMonthKeysUtc(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKeyUtc(dt));
  }
  return keys;
}

function fxUsdToEur(): number {
  const v = Number(process.env.INVESTOR_FX_USD_EUR ?? '0.92');
  return Number.isFinite(v) && v > 0 ? v : 0.92;
}

/** Centimes Stripe → EUR (factures). */
function invoiceCentsToEur(amount: number, currency: string): number {
  const cur = (currency ?? 'eur').toLowerCase();
  const v = amount / 100;
  if (cur === 'eur') return v;
  if (cur === 'usd') return v * fxUsdToEur();
  return v;
}

/** Solde Stripe : `amount` déjà en plus petite unité (centimes). */
function balanceCentsToEur(amount: number, currency: string): number {
  return invoiceCentsToEur(amount, currency);
}

function subscriptionBillingAnnual(sub: Stripe.Subscription): boolean {
  for (const item of sub.items.data) {
    if (item.price?.recurring?.interval === 'year') return true;
  }
  return false;
}

async function fetchPaidInvoiceTotalsByMonthEur(
  stripe: Stripe,
  monthsBack: number
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const cutoff = Math.floor(Date.now() / 1000) - monthsBack * 31 * 86400;
  let starting_after: string | undefined;
  outer: for (let i = 0; i < INVOICE_LIST_MAX_PAGES; i++) {
    const res = await stripe.invoices.list({
      status: 'paid',
      limit: 100,
      starting_after,
    });
    for (const inv of res.data) {
      if (inv.created < cutoff) break outer;
      if (!inv.amount_paid) continue;
      const mk = monthKeyUtc(new Date(inv.created * 1000));
      const eur = invoiceCentsToEur(inv.amount_paid, inv.currency ?? 'eur');
      map.set(mk, (map.get(mk) ?? 0) + eur);
    }
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1]?.id;
    if (!res.data.length) break;
  }
  return map;
}

function buildPaidRevenueHistory(
  map: Map<string, number>,
  horizonMonths: number
): { series: PaidRevenueMonthRow[]; meta: PaidRevenueHistoryMeta } {
  const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  const series: PaidRevenueMonthRow[] = sorted.map(([monthKey, raw]) => ({
    monthKey,
    label: formatMonthLabel(monthKey),
    paidEur: Number(raw.toFixed(2)),
  }));
  const sum = series.reduce((s, x) => s + x.paidEur, 0);
  return {
    series,
    meta: {
      horizonMonths,
      monthsWithData: series.length,
      firstMonthKey: series[0]?.monthKey ?? null,
      lastMonthKey: series[series.length - 1]?.monthKey ?? null,
      sumPaidEurInSeries: Number(sum.toFixed(2)),
    },
  };
}

function parseOpenAiCostsTotalUsd(json: Record<string, unknown>): number | null {
  const data = json.data;
  if (!Array.isArray(data)) return null;
  let total = 0;
  let found = false;
  for (const bucket of data) {
    if (typeof bucket !== 'object' || bucket === null) continue;
    const results = (bucket as { results?: unknown[] }).results;
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      if (typeof r !== 'object' || r === null) continue;
      const amount = (r as { amount?: { value?: string | number; currency?: string } }).amount;
      if (!amount) continue;
      const raw = amount.value;
      const v = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (!Number.isFinite(v)) continue;
      const cur = (amount.currency ?? 'usd').toLowerCase();
      total += cur === 'eur' ? v : v;
      found = true;
    }
  }
  return found ? total : null;
}

async function fetchOpenAiMonthSpendEur(): Promise<{ eur: number | null; error?: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  const fallbackRaw = process.env.INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR?.trim();
  const fallback =
    fallbackRaw !== undefined && fallbackRaw !== '' ? Number(fallbackRaw) : null;

  if (!key) {
    return { eur: fallback !== null && Number.isFinite(fallback) ? fallback : null, error: 'no_openai_key' };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startUnix = Math.floor(start.getTime() / 1000);
  const endUnix = Math.floor(now.getTime() / 1000);

  try {
    const url = new URL('https://api.openai.com/v1/organization/costs');
    url.searchParams.set('start_time', String(startUnix));
    url.searchParams.set('end_time', String(endUnix));
    url.searchParams.set('bucket_width', '1d');
    url.searchParams.set('limit', '62');

    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    const org = process.env.OPENAI_ORGANIZATION_ID?.trim();
    if (org) headers['OpenAI-Organization'] = org;

    const res = await fetch(url.toString(), { headers, cache: 'no-store' });
    if (!res.ok) {
      return {
        eur: fallback !== null && Number.isFinite(fallback) ? fallback : null,
        error: `openai_costs_http_${res.status}`,
      };
    }
    const json = (await res.json()) as Record<string, unknown>;
    const usd = parseOpenAiCostsTotalUsd(json);
    if (usd == null || !Number.isFinite(usd)) {
      return {
        eur: fallback !== null && Number.isFinite(fallback) ? fallback : null,
        error: 'openai_costs_parse',
      };
    }
    return { eur: usd * fxUsdToEur() };
  } catch (e) {
    return {
      eur: fallback !== null && Number.isFinite(fallback) ? fallback : null,
      error: e instanceof Error ? e.message : 'openai_fetch_error',
    };
  }
}

function resendMonthlyEstimateEur(): number {
  const v = Number(process.env.INVESTOR_RESEND_MONTHLY_EUR ?? '0');
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

function buildPlanMix(subs: Stripe.Subscription[]): PlanSlice[] {
  const counts: Record<PlanSlug, number> = { vision: 0, pulse: 0, zenith: 0 };
  for (const sub of subs) {
    const slug = getPlanSlugFromSubscription(sub);
    if (slug) counts[slug] += 1;
  }
  const total = counts.vision + counts.pulse + counts.zenith;
  if (total === 0) {
    return [
      {
        name: 'Aucun abo. actif / trialing',
        pct: 100,
        count: 0,
        fill: '#3f3f46',
      },
    ];
  }
  return (['vision', 'pulse', 'zenith'] as PlanSlug[]).map((slug) => ({
    name: PLAN_LABELS[slug],
    count: counts[slug],
    pct: Math.round((100 * counts[slug]) / total),
    fill: PLAN_COLORS[slug],
  }));
}

type ProfileCohortRow = {
  id: string;
  created_at: string;
  subscription_status: string | null;
  /** Pour exclure les admins des cohortes (pas du rapprochement Stripe). */
  role: string | null;
  email: string | null;
  full_name: string | null;
  establishment_name: string | null;
  phone: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function planLabelFromSlug(slug: PlanSlug | null, fallbackMrr: number): string {
  if (slug) return PLAN_LABELS[slug];
  if (fallbackMrr >= 1) return `Forfait (~${fallbackMrr.toFixed(0)} € MRR)`;
  return 'Sans MRR facturé sur lignes récurrentes';
}

function stripeCustomerEmail(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (typeof c === 'string') return null;
  if (!c || typeof c !== 'object') return null;
  const em = (c as { email?: string | null }).email;
  return typeof em === 'string' && em.trim() ? em.trim().toLowerCase() : null;
}

function stripeCustomerIdString(sub: Stripe.Subscription): string {
  const c = sub.customer;
  if (typeof c === 'string') return c;
  if (c && typeof c === 'object' && 'id' in c && typeof (c as { id?: string }).id === 'string') {
    return (c as { id: string }).id;
  }
  return '';
}

function buildUnitEconomics(
  subs: Stripe.Subscription[],
  profiles: ProfileCohortRow[],
  mrrTotal: number,
  variableCostsMonth: number
): InvestorUnitEconomics {
  const explainSimpleFr = '';
  const methodNoteFr = '';

  const bySubId = new Map<string, ProfileCohortRow>();
  const byCustomerId = new Map<string, ProfileCohortRow>();
  const byProfileEmail = new Map<string, ProfileCohortRow>();
  for (const p of profiles) {
    if (p.stripe_subscription_id) bySubId.set(p.stripe_subscription_id, p);
    if (p.stripe_customer_id) byCustomerId.set(p.stripe_customer_id, p);
    if (p.email?.trim()) byProfileEmail.set(p.email.trim().toLowerCase(), p);
  }

  let trialingCount = 0;
  let activeCount = 0;
  const rows: SubscriberEconomicsRow[] = [];
  for (const sub of subs) {
    if (sub.status === 'trialing') trialingCount += 1;
    if (sub.status === 'active') activeCount += 1;
    const subMrr = sumSubscriptionMonthlyEur(sub);
    const pctOfMrr = mrrTotal > 0 ? (100 * subMrr) / mrrTotal : 0;
    const allocated = mrrTotal > 0 ? (subMrr / mrrTotal) * variableCostsMonth : 0;
    const contribution = subMrr - allocated;
    const marginPct = subMrr > 0.0001 ? (100 * contribution) / subMrr : null;

    const cid = stripeCustomerIdString(sub);
    const custEmail = stripeCustomerEmail(sub);
    let prof: ProfileCohortRow | null = bySubId.get(sub.id) ?? null;
    let profileMatch: SubscriberEconomicsRow['profileMatch'] = 'none';
    if (prof) profileMatch = 'stripe_subscription_id';
    else if (cid) {
      const pc = byCustomerId.get(cid);
      if (pc) {
        prof = pc;
        profileMatch = 'stripe_customer_id';
      }
    }
    if (!prof && custEmail) {
      const pe = byProfileEmail.get(custEmail);
      if (pe) {
        prof = pe;
        profileMatch = 'email';
      }
    }
    const displayParts = prof
      ? [prof.full_name, prof.establishment_name].filter((x) => x && String(x).trim())
      : [];
    const displayLabel =
      displayParts.length > 0
        ? displayParts.join(' · ')
        : prof?.email?.trim() ||
          custEmail ||
          (cid ? `Client Stripe (${cid.slice(0, 10)}…)` : 'Abonnement Stripe');

    const slug = getPlanSlugFromSubscription(sub);
    const billingAnnual = subscriptionBillingAnnual(sub);

    rows.push({
      profileId: prof?.id ?? null,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: cid,
      customerEmail: custEmail,
      profileMatch,
      displayLabel,
      email: prof?.email ?? null,
      fullName: prof?.full_name?.trim() ? prof.full_name.trim() : null,
      establishmentName: prof?.establishment_name?.trim() ? prof.establishment_name.trim() : null,
      phone: prof?.phone?.trim() ? prof.phone.trim() : null,
      planSlug: slug,
      planLabel: planLabelFromSlug(slug, subMrr),
      billingAnnual,
      subscriptionStatus: sub.status,
      mrrEur: Number(subMrr.toFixed(2)),
      pctOfMrr: Number(pctOfMrr.toFixed(1)),
      allocatedVariableCostEur: Number(allocated.toFixed(2)),
      estimatedContributionEur: Number(contribution.toFixed(2)),
      estimatedMarginPct: marginPct != null ? Number(marginPct.toFixed(1)) : null,
    });
  }

  rows.sort((a, b) => b.mrrEur - a.mrrEur);
  const unmatchedStripeSubs = rows.filter((r) => r.profileId == null).length;

  const contributionAfter = mrrTotal - variableCostsMonth;
  return {
    explainSimpleFr,
    methodNoteFr,
    rows,
    totals: {
      mrrEur: Number(mrrTotal.toFixed(2)),
      variableCostsEur: Number(variableCostsMonth.toFixed(2)),
      contributionAfterVariableEur: Number(contributionAfter.toFixed(2)),
      contributionMarginPct:
        mrrTotal > 0 ? Number(((100 * contributionAfter) / mrrTotal).toFixed(1)) : null,
      variableCostRatioPct:
        mrrTotal > 0 ? Number(((100 * variableCostsMonth) / mrrTotal).toFixed(1)) : null,
      avgMrrPerSubEur: subs.length > 0 ? Number((mrrTotal / subs.length).toFixed(2)) : 0,
      activeCount,
      trialingCount,
      unmatchedStripeSubs,
    },
  };
}

function buildCohorts(rows: ProfileCohortRow[], trailingMonthCount = 8): CohortPoint[] {
  const byMonth = new Map<string, ProfileCohortRow[]>();
  for (const r of rows) {
    const mk = monthKeyUtc(new Date(r.created_at));
    if (!byMonth.has(mk)) byMonth.set(mk, []);
    byMonth.get(mk)!.push(r);
  }
  const keys = Array.from(byMonth.keys()).sort();
  const last = keys.slice(-Math.max(1, trailingMonthCount));
  return last.map((k) => {
    const group = byMonth.get(k) ?? [];
    const signed = group.length;
    const retained = group.filter(
      (p) => p.subscription_status === 'active' || p.subscription_status === 'trialing'
    ).length;
    return {
      cohorte: formatMonthLabel(k),
      signed,
      retained,
      rétention: signed > 0 ? Math.round((100 * retained) / signed) : 0,
    };
  });
}

/** Libellé opérationnel pour la bannière admin (coûts OpenAI). */
export function investorOpenaiCostStatusMessage(error?: string): string | null {
  if (!error) return null;
  const map: Record<string, string> = {
    no_openai_key:
      'Clé OpenAI absente — renseigner OPENAI_API_KEY ou un montant de repli INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR.',
    openai_costs_http_403:
      'OpenAI refuse l’endpoint coûts (HTTP 403) — la clé doit avoir les droits d’administration sur l’organisation, ou utilisez INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR.',
    openai_costs_parse:
      'Réponse OpenAI inattendue — vérifier l’API organization costs ou définir INVESTOR_OPENAI_MONTHLY_FALLBACK_EUR.',
  };
  return map[error] ?? `Lecture coûts OpenAI : ${error}`;
}

export async function buildInvestorMetrics(admin: SupabaseClient): Promise<InvestorMetricsPayload> {
  const stripe = getStripe();

  const [balance, subs, invoiceByMonth, openaiBurn, profilesRes] = await Promise.all([
    stripe.balance.retrieve(),
    listSubscriptionsForMrr(stripe),
    fetchPaidInvoiceTotalsByMonthEur(stripe, PAID_INVOICE_HISTORY_MONTHS),
    fetchOpenAiMonthSpendEur(),
    admin
      .from('profiles')
      .select(
        'id, created_at, subscription_status, role, email, full_name, establishment_name, phone, stripe_customer_id, stripe_subscription_id'
      ),
  ]);

  let availableEur = 0;
  let pendingEur = 0;
  for (const b of balance.available) {
    availableEur += balanceCentsToEur(b.amount, b.currency);
  }
  for (const b of balance.pending) {
    pendingEur += balanceCentsToEur(b.amount, b.currency);
  }
  const totalCashEur = availableEur + pendingEur;

  let mrrEur = 0;
  for (const s of subs) {
    mrrEur += sumSubscriptionMonthlyEur(s);
  }
  mrrEur = Number(mrrEur.toFixed(2));

  const [canceled30, newMerchants30d] = await Promise.all([
    countCanceledSubscriptionsSince(stripe, 30),
    countNewMerchantProfilesLast30d(admin),
  ]);
  const generatedAt = new Date().toISOString();
  const saasKpis: SaasKpisPayload = {
    generatedAt,
    mrrEur,
    activePayingSubscriptions: subs.length,
    ...computeSaasKpisFields({
      mrrEur,
      activeSubCount: subs.length,
      canceledLast30d: canceled30,
      newMerchantProfiles30d: newMerchants30d,
    }),
  };

  const resendEur = resendMonthlyEstimateEur();
  const openaiEur = openaiBurn.eur;
  const totalBurnMonth =
    (openaiEur ?? 0) + resendEur;

  const monthKeys = lastNMonthKeysUtc(6);
  const burnMonthK = totalBurnMonth / 1000;
  const burnVsGrowth: BurnGrowthPoint[] = monthKeys.map((k) => ({
    m: formatMonthLabel(k),
    growth: Number(((invoiceByMonth.get(k) ?? 0) / 1000).toFixed(2)),
    burn: Number(burnMonthK.toFixed(2)),
  }));

  if (profilesRes.error) {
    console.warn('[investor-metrics] profiles', profilesRes.error);
  }
  const allProfileRows = (profilesRes.data ?? []) as ProfileCohortRow[];
  /** Cohortes : hors comptes admin uniquement (même logique qu’avant la requête filtrée). */
  const cohortProfiles = allProfileRows.filter((p) => p.role !== 'admin');
  const cohorts = buildCohorts(cohortProfiles, 8);
  const cohortsExtended = buildCohorts(cohortProfiles, 36);

  const executiveProjection = computeExecutiveProjection(mrrEur, invoiceByMonth);

  /** Rapprochement Stripe : tous les profils (évite tout effet de bord si le filtre SQL excluait des lignes attendues). */
  const unitEconomics = buildUnitEconomics(subs, allProfileRows, mrrEur, totalBurnMonth);

  const { series: paidRevenueHistory, meta: paidRevenueHistoryMeta } = buildPaidRevenueHistory(
    invoiceByMonth,
    PAID_INVOICE_HISTORY_MONTHS
  );

  return {
    generatedAt,
    stripe: {
      availableEur,
      pendingEur,
      totalCashEur,
      mrrEur,
      activeSubscriptions: subs.length,
    },
    burnOps: {
      openaiEurMonth: openaiEur,
      resendEurMonth: resendEur,
      totalEurMonth: totalBurnMonth,
      openaiError: openaiBurn.error,
    },
    planMix: buildPlanMix(subs),
    burnVsGrowth,
    cohorts,
    cohortsExtended,
    paidRevenueHistory,
    paidRevenueHistoryMeta,
    nonAdminProfilesLoaded: cohortProfiles.length,
    executiveProjection,
    unitEconomics,
    saasKpis,
  };
}
