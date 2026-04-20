/**
 * KPIs SaaS (admin) : churn logo approximatif, ARPU, LTV indicatif, CPA optionnel (dépense marketing / inscriptions).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe-client';
import {
  countCanceledSubscriptionsSince,
  listSubscriptionsForMrr,
  sumSubscriptionMonthlyEur,
} from '@/lib/admin/stripe-mrr-helpers';

const LIFETIME_MONTHS_CAP = 120;

export type SaasKpisPayload = {
  generatedAt: string;
  mrrEur: number;
  activePayingSubscriptions: number;
  canceledSubscriptionsLast30d: number;
  newMerchantProfilesLast30d: number;
  /** Churn logo ~ annulations 30j / (actifs + annulations 30j) — indicatif, non audité. */
  logoChurnMonthlyPct: number | null;
  arpuEur: number | null;
  /** Durée de vie moyenne (mois) si churn > 0, plafonnée. */
  estimatedLifetimeMonths: number | null;
  /** ARPU × mois de vie estimés (ordre de grandeur). */
  estimatedLtvEur: number | null;
  /** INVESTOR_MARKETING_SPEND_MONTHLY_EUR / nouveaux profils marchands 30j (si dépense renseignée). */
  cpaEur: number | null;
  marketingSpendMonthlyEur: number | null;
};

function marketingSpendMonthlyEur(): number | null {
  const raw = process.env.INVESTOR_MARKETING_SPEND_MONTHLY_EUR?.trim();
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function countNewMerchantProfilesLast30d(admin: SupabaseClient): Promise<number> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count, error } = await admin
    .from('profiles')
    .select('id', { head: true, count: 'exact' })
    .neq('role', 'admin')
    .gte('created_at', since);
  if (error) {
    console.warn('[saas-kpis] countNewMerchantProfilesLast30d', error);
    return 0;
  }
  return count ?? 0;
}

export function computeSaasKpisFields(input: {
  mrrEur: number;
  activeSubCount: number;
  canceledLast30d: number;
  newMerchantProfiles30d: number;
}): Omit<SaasKpisPayload, 'generatedAt' | 'mrrEur' | 'activePayingSubscriptions'> {
  const { mrrEur, activeSubCount, canceledLast30d, newMerchantProfiles30d } = input;
  const denom = activeSubCount + canceledLast30d;
  const churnDec = denom > 0 ? canceledLast30d / denom : null;
  const logoChurnMonthlyPct =
    churnDec != null && churnDec >= 0 ? Number((100 * churnDec).toFixed(2)) : null;

  const arpuEur =
    activeSubCount > 0 ? Number((mrrEur / activeSubCount).toFixed(2)) : null;

  let estimatedLifetimeMonths: number | null = null;
  if (churnDec != null && churnDec > 0.000_01) {
    estimatedLifetimeMonths = Math.min(LIFETIME_MONTHS_CAP, Math.round((1 / churnDec) * 10) / 10);
  }

  const estimatedLtvEur =
    arpuEur != null && estimatedLifetimeMonths != null
      ? Number((arpuEur * estimatedLifetimeMonths).toFixed(2))
      : null;

  const spend = marketingSpendMonthlyEur();
  let cpaEur: number | null = null;
  if (spend != null && spend > 0 && newMerchantProfiles30d > 0) {
    cpaEur = Number((spend / newMerchantProfiles30d).toFixed(2));
  }

  return {
    canceledSubscriptionsLast30d: canceledLast30d,
    newMerchantProfilesLast30d: newMerchantProfiles30d,
    logoChurnMonthlyPct,
    arpuEur,
    estimatedLifetimeMonths,
    estimatedLtvEur,
    cpaEur,
    marketingSpendMonthlyEur: spend,
  };
}

/** Agrégat complet pour le bandeau admin / route légère (réutilise la même logique que investor-metrics). */
export async function buildSaasKpisPayload(admin: SupabaseClient): Promise<SaasKpisPayload | null> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return null;
  const stripe = getStripe();
  const [subs, canceled30, newMerchants30d] = await Promise.all([
    listSubscriptionsForMrr(stripe),
    countCanceledSubscriptionsSince(stripe, 30),
    countNewMerchantProfilesLast30d(admin),
  ]);
  let mrrEur = 0;
  for (const s of subs) {
    mrrEur += sumSubscriptionMonthlyEur(s);
  }
  mrrEur = Number(mrrEur.toFixed(2));
  const rest = computeSaasKpisFields({
    mrrEur,
    activeSubCount: subs.length,
    canceledLast30d: canceled30,
    newMerchantProfiles30d: newMerchants30d,
  });
  return {
    generatedAt: new Date().toISOString(),
    mrrEur,
    activePayingSubscriptions: subs.length,
    ...rest,
  };
}
