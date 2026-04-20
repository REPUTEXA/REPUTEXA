/**
 * Source de vérité unique : Stripe.
 * GET : retourne quantité, plan, interval depuis Stripe. Délègue au BillingDomainService.
 * Règle : pas de slots fantômes (quantité mise à jour en DB seulement quand la dernière facture est payée).
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import type { PlanSlug } from '@/lib/feature-gate';
import {
  findActiveSubscriptionForCustomer,
  retrieveSubscription,
  buildProfileSyncFromSubscription,
  getQuantitySafeToSync,
  getPlanSlugFromSubscription,
  getSubscriptionInterval,
  PLAN_SLUG_TO_SUBSCRIPTION,
} from '@/lib/services/billing-domain';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email?.trim()) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const _email = user.email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_quantity')
      .eq('id', user.id)
      .single();

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    const subscriptionIdFromProfile = profile?.stripe_subscription_id as string | null | undefined;
    const dbQuantity = typeof profile?.subscription_quantity === 'number' ? profile.subscription_quantity : null;

    let subscription: Awaited<ReturnType<typeof retrieveSubscription>> | null = null;

    if (subscriptionIdFromProfile) {
      try {
        const sub = await retrieveSubscription(subscriptionIdFromProfile);
        if (sub.status === 'active' || sub.status === 'trialing') subscription = sub;
      } catch {
        // Abonnement supprimé ou invalide
      }
    }

    if (!subscription && customerId) {
      subscription = await findActiveSubscriptionForCustomer(customerId);
    }

    if (!subscription) {
      return NextResponse.json({
        quantity: Math.max(1, dbQuantity ?? 1),
        planSlug: 'vision' as PlanSlug,
        subscriptionId: null,
        fromStripe: false,
        interval: 'month' as const,
      });
    }

    const quantityToWrite = await getQuantitySafeToSync(subscription, dbQuantity);
    const planSlug = (getPlanSlugFromSubscription(subscription) ?? 'vision') as PlanSlug;
    const interval = getSubscriptionInterval(subscription);
    const subscriptionPlan =
      (PLAN_SLUG_TO_SUBSCRIPTION as Record<string, string>)[planSlug] ?? planSlug;
    const payload = buildProfileSyncFromSubscription(subscription);
    const status = payload.subscription_status;
    const periodEnd = payload.subscription_period_end;
    const trialEndsAt = payload.trial_ends_at;

    const updatePayload: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      selected_plan: planSlug,
      subscription_plan: subscriptionPlan,
      subscription_status: status,
      subscription_period_end: periodEnd,
      subscription_quantity: quantityToWrite,
      trial_ends_at: trialEndsAt,
    };
    if (payload.stripe_customer_id) updatePayload.stripe_customer_id = payload.stripe_customer_id;

    await supabase.from('profiles').update(updatePayload).eq('id', user.id);

    return NextResponse.json({
      quantity: quantityToWrite,
      planSlug,
      subscriptionId: subscription.id,
      fromStripe: true,
      interval,
    });
  } catch (err) {
    console.error('[stripe/subscription GET]', err);
    return apiBillingJsonError(request, 'subscriptionReadFailed', 500);
  }
}
