import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/site-url';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

/**
 * Redirection post-checkout Stripe : sync le profil Supabase côté serveur avant d'afficher le dashboard.
 * Évite que le layout redirige vers /upgrade car subscription_status n'est pas encore à jour (webhook asynchrone).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id')?.trim() ?? '';
    const locale = searchParams.get('locale') ?? 'fr';
    const plan = searchParams.get('plan') ?? 'pulse';
    const statusParam = searchParams.get('status') ?? 'success';

    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const dashboardUrl = `${baseUrl}/${locale}/dashboard?status=${statusParam}&plan=${plan}`;

    if (!sessionId || !secretKey) {
      return NextResponse.redirect(`${baseUrl}/${locale}/dashboard`);
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    const customer = session.customer as Stripe.Customer | null;
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : customer?.id ?? null;
    const customerEmail =
      (typeof customer === 'object' && customer?.email) ||
      (session.customer_details?.email ?? '');
    const planSlug = String(session.metadata?.planSlug ?? plan);
    const subscriptionId = session.subscription as string | null;

    const validPlan = ['vision', 'pulse', 'zenith'].includes(planSlug) ? planSlug : plan;
    const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[validPlan] ?? 'pulse';

    let subscriptionStatus = 'active';
    let trialEndsAt: string | null = null;

    if (subscriptionId) {
      const subscription =
        typeof session.subscription === 'object' && session.subscription
          ? (session.subscription as Stripe.Subscription)
          : await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus =
        subscription.status === 'trialing'
          ? 'trialing'
          : subscription.status === 'active'
            ? 'active'
            : 'expired';
      trialEndsAt =
        subscription.trial_end != null
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;
    }

    const admin = createAdminClient();
    if (admin && customerEmail) {
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
    }

    return NextResponse.redirect(dashboardUrl);
  } catch {
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const locale = new URL(request.url).searchParams.get('locale') ?? 'fr';
    return NextResponse.redirect(`${baseUrl}/${locale}/dashboard`);
  }
}
