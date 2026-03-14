import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

/**
 * Après retour Stripe : met à jour selected_plan et subscription_plan dans Supabase
 * pour que le cadenas disparaisse sans déconnexion.
 * Appelé par le dashboard quand ?session_id=xxx est présent.
 */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';

    if (!sessionId || !secretKey) {
      return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 });
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    const customer = session.customer as Stripe.Customer | null;
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

    if (subscriptionId) {
      const subscription = typeof session.subscription === 'object' && session.subscription
        ? (session.subscription as Stripe.Subscription)
        : await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = subscription.status === 'trialing' ? 'trialing' : subscription.status === 'active' ? 'active' : 'expired';
      trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
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

    if (profiles && profiles.length > 0) {
      await admin
        .from('profiles')
        .update({
          selected_plan: validPlan,
          subscription_plan: subscriptionPlan,
          subscription_status: subscriptionStatus,
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
