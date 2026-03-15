/**
 * Source de vérité unique : Stripe.
 * GET : retourne quantité, plan, interval depuis Stripe.
 * Règle : si Stripe dit X, la DB est alignée silencieusement (sauf slots non encore payés).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanSlugFromSubscription, getSubscriptionQuantity, getSubscriptionInterval } from '@/lib/stripe-subscription';
import { stripeWithRetry } from '@/lib/stripe-client';
import type { PlanSlug } from '@/lib/feature-gate';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

export async function GET() {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe non configuré' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_quantity')
      .eq('id', user.id)
      .single();

    const customerId = profile?.stripe_customer_id as string | null | undefined;
    const subscriptionIdFromProfile = profile?.stripe_subscription_id as string | null | undefined;
    const dbQuantity = typeof profile?.subscription_quantity === 'number' ? profile.subscription_quantity : null;

    let subscription: import('stripe').Stripe.Subscription | null = null;

    if (subscriptionIdFromProfile) {
      try {
        const sub = await stripeWithRetry((s) => s.subscriptions.retrieve(subscriptionIdFromProfile!), secretKey);
        if (sub.status === 'active' || sub.status === 'trialing') subscription = sub;
      } catch {
        // Abonnement supprimé ou invalide
      }
    }

    if (!subscription && customerId) {
      const subs = await stripeWithRetry(
        (s) => s.subscriptions.list({ customer: customerId!, status: 'all', limit: 10 }),
        secretKey
      );
      const activeOrTrialing = subs.data.filter((s) => s.status === 'active' || s.status === 'trialing');
      if (activeOrTrialing.length > 0) subscription = activeOrTrialing[0];
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

    const quantity = getSubscriptionQuantity(subscription);
    const planSlug = (getPlanSlugFromSubscription(subscription) ?? 'vision') as PlanSlug;
    const interval = getSubscriptionInterval(subscription);
    const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[planSlug] ?? 'pulse';
    const status = subscription.status === 'trialing' ? 'trialing' : subscription.status === 'active' ? 'active' : 'expired';
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const trialEndsAt = status === 'trialing' && subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null;

    // Stripe = source de vérité : on détermine si on peut écrire la quantité en DB (éviter slots fantômes si expansion non payée)
    let quantityToReturn = quantity;
    const shouldSyncQuantity =
      dbQuantity === null ||
      quantity <= dbQuantity ||
      (await (async () => {
        const latestInvoiceId =
          typeof subscription.latest_invoice === 'string'
            ? subscription.latest_invoice
            : subscription.latest_invoice?.id;
        if (!latestInvoiceId) return false;
        try {
          const inv = await stripeWithRetry((s) => s.invoices.retrieve(latestInvoiceId), secretKey);
          return inv.status === 'paid';
        } catch {
          return false;
        }
      })());

    if (!shouldSyncQuantity && dbQuantity !== null) quantityToReturn = dbQuantity;

    // Alignement DB ← Stripe : toujours écrire les champs non-ambiguës (plan, status, period_end, ids)
    const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as { id?: string })?.id ?? null;
    const updatePayload: Record<string, unknown> = {
      stripe_subscription_id: subscription.id,
      selected_plan: planSlug,
      subscription_plan: subscriptionPlan,
      subscription_status: status,
      subscription_period_end: periodEnd,
      trial_ends_at: trialEndsAt,
    };
    if (stripeCustomerId) updatePayload.stripe_customer_id = stripeCustomerId;
    if (shouldSyncQuantity) updatePayload.subscription_quantity = quantity;

    await supabase.from('profiles').update(updatePayload).eq('id', user.id);

    return NextResponse.json({
      quantity: quantityToReturn,
      planSlug,
      subscriptionId: subscription.id,
      fromStripe: true,
      interval,
    });
  } catch (err) {
    console.error('[stripe/subscription GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
