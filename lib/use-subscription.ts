'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlanSlug } from '@/lib/feature-gate';

export const SUBSCRIPTION_QUERY_KEY = ['subscription'] as const;

export type BillingInterval = 'month' | 'year';

export type SubscriptionData = {
  quantity: number;
  planSlug: PlanSlug;
  subscriptionId: string | null;
  fromStripe: boolean;
  interval: BillingInterval;
};

async function fetchSubscription(): Promise<SubscriptionData> {
  const res = await fetch('/api/stripe/subscription', { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erreur chargement abonnement');
  }
  const data = await res.json();
  return {
    quantity: typeof data.quantity === 'number' && data.quantity >= 1 ? data.quantity : 1,
    planSlug: data.planSlug ?? 'vision',
    subscriptionId: data.subscriptionId ?? null,
    fromStripe: data.fromStripe === true,
    interval: data.interval === 'year' ? 'year' : 'month',
  };
}

/**
 * Source de vérité unique : Stripe.
 * Récupère la quantité (et le plan) en temps réel avec cache intelligent.
 * À chaque chargement, l'API sync Stripe → Supabase si différent.
 */
export function useSubscription() {
  const query = useQuery({
    queryKey: SUBSCRIPTION_QUERY_KEY,
    queryFn: fetchSubscription,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  return {
    quantity: query.data?.quantity ?? 1,
    planSlug: query.data?.planSlug ?? 'vision',
    subscriptionId: query.data?.subscriptionId ?? null,
    fromStripe: query.data?.fromStripe ?? false,
    interval: query.data?.interval ?? 'month',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
