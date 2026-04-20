/**
 * Helpers Stripe partagés — liste d’abonnements actifs/trialing (MRR) et annulations récentes.
 */

import type Stripe from 'stripe';

/** MRR mensualisé sommé sur les line items (EUR depuis unit_amount centimes — aligné historique investor-metrics). */
export function sumSubscriptionMonthlyEur(sub: Stripe.Subscription): number {
  let total = 0;
  for (const item of sub.items.data) {
    const price = item.price;
    if (!price?.unit_amount || !price.recurring) continue;
    const qty = item.quantity ?? 1;
    let monthly = (price.unit_amount * qty) / 100;
    const interval = price.recurring.interval;
    if (interval === 'year') monthly /= 12;
    else if (interval === 'week') monthly = (monthly * 52) / 12;
    else if (interval === 'day') monthly *= 30;
    total += monthly;
  }
  return total;
}

export async function listSubscriptionsForMrr(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  for (const status of ['active', 'trialing'] as const) {
    let starting_after: string | undefined;
    for (let page = 0; page < 40; page++) {
      const res = await stripe.subscriptions.list({
        status,
        limit: 100,
        starting_after,
        expand: ['data.customer', 'data.items.data.price'],
      });
      out.push(...res.data);
      if (!res.has_more) break;
      starting_after = res.data[res.data.length - 1]?.id;
      if (!starting_after) break;
    }
  }
  return out;
}

/**
 * Abonnements passés à canceled dans les `days` derniers jours (horloge Stripe sur canceled_at).
 */
export async function countCanceledSubscriptionsSince(stripe: Stripe, days: number): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  let count = 0;
  let starting_after: string | undefined;
  for (let page = 0; page < 80; page++) {
    const res = await stripe.subscriptions.list({
      status: 'canceled',
      limit: 100,
      starting_after,
    });
    for (const sub of res.data) {
      const ca = sub.canceled_at ?? 0;
      if (ca >= cutoff) count += 1;
    }
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1]?.id;
    if (!res.data.length) break;
  }
  return count;
}
