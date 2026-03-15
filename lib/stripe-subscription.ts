/**
 * Helpers partagés pour lire la quantité et le plan depuis un abonnement Stripe.
 * Source de vérité unique : Stripe.
 */

import type Stripe from 'stripe';
import { PRICE_ID_ENV_KEYS } from '@/config/pricing';

export function getPlanSlugFromSubscription(subscription: Stripe.Subscription): 'vision' | 'pulse' | 'zenith' | null {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  const ids = [
    process.env[PRICE_ID_ENV_KEYS.vision.monthly],
    process.env[PRICE_ID_ENV_KEYS.vision.annual],
    process.env[PRICE_ID_ENV_KEYS.pulse.monthly],
    process.env[PRICE_ID_ENV_KEYS.pulse.annual],
    process.env[PRICE_ID_ENV_KEYS.zenith.monthly],
    process.env[PRICE_ID_ENV_KEYS.zenith.annual],
  ];
  if (ids[0] === priceId || ids[1] === priceId) return 'vision';
  if (ids[2] === priceId || ids[3] === priceId) return 'pulse';
  if (ids[4] === priceId || ids[5] === priceId) return 'zenith';
  return null;
}

export function getSubscriptionQuantity(subscription: Stripe.Subscription): number {
  const qty = subscription.items?.data?.[0]?.quantity;
  return typeof qty === 'number' && qty >= 1 ? qty : 1;
}

/** Intervalle de facturation actif (month | year). Source de vérité pour l'UI. */
export function getSubscriptionInterval(subscription: Stripe.Subscription): 'month' | 'year' {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'year' : 'month';
}
