/**
 * Helpers partagés pour lire la quantité et le plan depuis un abonnement Stripe.
 * Source de vérité unique : Stripe ; ordre : Price IDs connus, métadonnées planSlug, puis MRR si les prix ne sont pas reconnus.
 */

import type Stripe from 'stripe';
import {
  listAllStripePriceIdsForPlan,
  monthlyMrrEurWithVolumeDiscounts,
  type BillingCurrency,
  type PlanSlug,
} from '@/config/pricing';

/** Devise de facturation du premier line item (pour appliquer le bon Price ID au changement de plan). */
export function billingCurrencyFromSubscription(subscription: Stripe.Subscription): BillingCurrency {
  const c = subscription.items?.data?.[0]?.price?.currency?.toLowerCase();
  if (c === 'usd') return 'usd';
  if (c === 'gbp') return 'gbp';
  if (c === 'jpy') return 'jpy';
  if (c === 'cny') return 'cny';
  if (c === 'chf') return 'chf';
  if (c === 'cad') return 'cad';
  if (c === 'aud') return 'aud';
  return 'eur';
}

/** MRR mensualisé d’un line item (EUR approx. depuis unit_amount). */
function itemMonthlyEur(item: Stripe.SubscriptionItem): number {
  const price = item.price;
  if (!price?.unit_amount || !price.recurring) return 0;
  const qty = item.quantity ?? 1;
  const cur = (price.currency ?? 'eur').toLowerCase();
  /** JPY : devise sans centimes — `unit_amount` est déjà en yens (Stripe zero-decimal). */
  const monthlyMajor =
    cur === 'jpy' ? price.unit_amount * qty : (price.unit_amount * qty) / 100;
  let monthly = monthlyMajor;
  const interval = price.recurring.interval;
  if (interval === 'year') monthly /= 12;
  else if (interval === 'week') monthly = (monthly * 52) / 12;
  else if (interval === 'day') monthly *= 30;
  if (cur === 'usd') {
    const fx = Number(process.env.INVESTOR_FX_USD_EUR ?? '0.92');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 0.92;
  } else if (cur === 'gbp') {
    const fx = Number(process.env.INVESTOR_FX_GBP_EUR ?? '1.17');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 1.17;
  } else if (cur === 'jpy') {
    const fx = Number(process.env.INVESTOR_FX_JPY_EUR ?? '0.0062');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 0.0062;
  } else if (cur === 'cny') {
    const fx = Number(process.env.INVESTOR_FX_CNY_EUR ?? '0.13');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 0.13;
  } else if (cur === 'chf') {
    const fx = Number(process.env.INVESTOR_FX_CHF_EUR ?? '1.05');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 1.05;
  } else if (cur === 'cad') {
    const fx = Number(process.env.INVESTOR_FX_CAD_EUR ?? '0.63');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 0.63;
  } else if (cur === 'aud') {
    const fx = Number(process.env.INVESTOR_FX_AUD_EUR ?? '0.58');
    monthly *= Number.isFinite(fx) && fx > 0 ? fx : 0.58;
  }
  return monthly;
}

function parsePlanSlugString(raw: unknown): PlanSlug | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (s === 'vision' || s === 'pulse' || s === 'zenith') return s;
  return null;
}

/**
 * Métadonnées explicites (checkout, portail) : à privilégier avant l'heuristique MRR,
 * qui peut classer un Zenith « inconnu » du catalogue comme Vision le plus proche.
 */
function planSlugFromExplicitStripeMetadata(subscription: Stripe.Subscription): PlanSlug | null {
  const fromSub = parsePlanSlugString(subscription.metadata?.planSlug);
  if (fromSub) return fromSub;
  for (const item of subscription.items?.data ?? []) {
    const fromPrice = parsePlanSlugString(item.price?.metadata?.planSlug);
    if (fromPrice) return fromPrice;
  }
  return null;
}

/**
 * Après métadonnées `planSlug` (abonnement / prix) : repli MRR quand les Price IDs .env ne matchent pas
 * REPUTEXA pour la même quantité et le même cycle (y compris paliers dégressifs multi-sièges).
 * L’ancienne version comparait au prix d’une seule place, donc renvoyait null dès plusieurs sièges et tout retombait sur Vision.
 */
function inferPlanFromSubscriptionMrr(subscription: Stripe.Subscription): PlanSlug | null {
  const qtyRaw = subscription.items?.data?.[0]?.quantity;
  const qty = typeof qtyRaw === 'number' && qtyRaw >= 1 ? qtyRaw : 1;
  const isAnnual = subscription.items?.data?.[0]?.price?.recurring?.interval === 'year';
  let total = 0;
  for (const item of subscription.items?.data ?? []) {
    total += itemMonthlyEur(item);
  }
  if (!Number.isFinite(total) || total < 0.5) return null;

  const candidates: PlanSlug[] = ['vision', 'pulse', 'zenith'];
  let best: PlanSlug | null = null;
  let bestDist = Infinity;
  for (const slug of candidates) {
    const expected = monthlyMrrEurWithVolumeDiscounts(slug, qty, isAnnual);
    const d = Math.abs(total - expected);
    if (d < bestDist) {
      bestDist = d;
      best = slug;
    }
  }
  if (!best) return null;
  const expectedBest = monthlyMrrEurWithVolumeDiscounts(best, qty, isAnnual);
  /** FX, paliers, arrondis : tolérance relative + plancher */
  const tol = Math.max(50, Math.min(expectedBest * 0.22, 320));
  return bestDist <= tol ? best : null;
}

export function getSubscriptionQuantity(subscription: Stripe.Subscription): number {
  const qty = subscription.items?.data?.[0]?.quantity;
  return typeof qty === 'number' && qty >= 1 ? qty : 1;
}

export function getPlanSlugFromSubscription(subscription: Stripe.Subscription): PlanSlug | null {
  const vIds = listAllStripePriceIdsForPlan('vision');
  const pIds = listAllStripePriceIdsForPlan('pulse');
  const zIds = listAllStripePriceIdsForPlan('zenith');
  for (const item of subscription.items?.data ?? []) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    if (vIds.includes(priceId)) return 'vision';
    if (pIds.includes(priceId)) return 'pulse';
    if (zIds.includes(priceId)) return 'zenith';
  }

  const fromMeta = planSlugFromExplicitStripeMetadata(subscription);
  if (fromMeta) return fromMeta;

  return inferPlanFromSubscriptionMrr(subscription);
}

/** Intervalle de facturation actif (month | year). Source de vérité pour l'UI. */
export function getSubscriptionInterval(subscription: Stripe.Subscription): 'month' | 'year' {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'year' : 'month';
}
