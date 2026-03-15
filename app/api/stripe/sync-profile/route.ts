import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncProfileBodySchema } from '@/lib/validations/stripe';
import { getSubscriptionQuantity } from '@/lib/stripe-subscription';
import { stripeWithRetry } from '@/lib/stripe-client';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

/**
 * Après retour Stripe : aligne le profil Supabase sur la session (Stripe = source de vérité).
 * Inclut subscription_quantity et subscription_period_end pour zéro désync.
 */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = syncProfileBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 });
    }
    const { session_id: sessionId } = parsed.data;

    const session = await stripeWithRetry(
      (s) => s.checkout.sessions.retrieve(sessionId, { expand: ['customer', 'subscription'] }),
      secretKey
    );

    const customer = session.customer as { id?: string; email?: string } | null;
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : customer?.id ?? null;
    const customerEmail =
      (typeof customer === 'object' && customer?.email) ||
      (session.customer_details?.email ?? '');
    const planSlug = String(session.metadata?.planSlug ?? '');
    const subscriptionId = session.subscription as string | null;

    if (!customerEmail) {
      return NextResponse.json({ ok: false, error: 'No customer email' }, { status: 400 });
    }

    const validPlan = ['vision', 'pulse', 'zenith'].includes(planSlug) ? planSlug : 'pulse';
    const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[validPlan] ?? 'pulse';

    let subscriptionStatus = 'active';
    let trialEndsAt: string | null = null;
    let subscriptionQuantity = 1;
    let subscriptionPeriodEnd: string | null = null;

    if (subscriptionId) {
      const subscription = typeof session.subscription === 'object' && session.subscription
        ? (session.subscription as { status?: string; trial_end?: number; current_period_end?: number; items?: { data?: { quantity?: number }[] } })
        : await stripeWithRetry((s) => s.subscriptions.retrieve(subscriptionId), secretKey);
      subscriptionStatus = subscription.status === 'trialing' ? 'trialing' : subscription.status === 'active' ? 'active' : 'expired';
      trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      subscriptionQuantity = getSubscriptionQuantity(subscription as import('stripe').Stripe.Subscription);
      subscriptionPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase admin not configured' }, { status: 500 });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .limit(1);

    if (profiles?.length) {
      await admin
        .from('profiles')
        .update({
          selected_plan: validPlan,
          subscription_plan: subscriptionPlan,
          subscription_status: subscriptionStatus,
          subscription_quantity: subscriptionQuantity,
          subscription_period_end: subscriptionPeriodEnd,
          trial_ends_at: subscriptionStatus === 'trialing' ? trialEndsAt : null,
          stripe_subscription_id: subscriptionId,
          ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
        })
        .eq('id', profiles[0].id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[stripe/sync-profile]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
