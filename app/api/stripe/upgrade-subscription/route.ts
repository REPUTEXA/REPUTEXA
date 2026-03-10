import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSiteUrl } from '@/lib/site-url';

const PLAN_TO_PRICE_ENV: Record<string, string> = {
  vision: 'STRIPE_PRICE_ID_VISION',
  pulse: 'STRIPE_PRICE_ID_PULSE',
  zenith: 'STRIPE_PRICE_ID_ZENITH',
};

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : '';

    if (!['vision', 'pulse', 'zenith'].includes(planSlug)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const priceId = process.env[PLAN_TO_PRICE_ENV[planSlug]];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Configuration Stripe incomplète' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const stripe = new Stripe(secretKey);
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;

    if (!customerId) {
      return NextResponse.json(
        {
          needsCheckout: true,
          url: `${getSiteUrl()}/${request.headers.get('x-next-intl-locale') || 'fr'}/checkout?plan=${planSlug}&trial=0`,
        },
        { status: 200 }
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    const subscription = subscriptions.data[0];

    if (!subscription) {
      return NextResponse.json(
        {
          needsCheckout: true,
          url: `${getSiteUrl()}/${request.headers.get('x-next-intl-locale') || 'fr'}/checkout?plan=${planSlug}&trial=0`,
        },
        { status: 200 }
      );
    }

    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 });
    }

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      payment_behavior: 'pending_if_incomplete',
      metadata: { planSlug },
    });

    const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[planSlug] ?? 'pulse';
    const admin = createAdminClient();
    if (admin) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .limit(1);

      if (profiles?.length) {
        await admin
          .from('profiles')
          .update({
            selected_plan: planSlug,
            subscription_plan: subscriptionPlan,
            subscription_status: 'active',
          })
          .eq('id', profiles[0].id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[stripe/upgrade-subscription]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour',
      },
      { status: 500 }
    );
  }
}
