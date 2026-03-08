import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

const TRIAL_DAYS = 14;

const PLAN_ENV_KEYS = {
  starter: 'STRIPE_PRICE_ID_VISION',
  manager: 'STRIPE_PRICE_ID_PULSE',
  dominator: 'STRIPE_PRICE_ID_ZENITH',
} as const;

type PlanType = keyof typeof PLAN_ENV_KEYS;

function isValidPlan(plan: string | null): plan is PlanType {
  return plan !== null && plan in PLAN_ENV_KEYS;
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not configured' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = new Stripe(secretKey);
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const planType: PlanType = isValidPlan(searchParams.get('planType'))
      ? searchParams.get('planType') as PlanType
      : 'manager';

    const priceId = process.env[PLAN_ENV_KEYS[planType]];
    if (!priceId) {
      return NextResponse.json(
        { error: `${PLAN_ENV_KEYS[planType]} not configured` },
        { status: 500 }
      );
    }
    const baseUrl = getSiteUrl();

    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = existing.data[0]?.id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabaseUserId: user.id },
      });
      customerId = customer.id;
    }

    const successUrl = `${baseUrl}/${locale}/dashboard?welcome=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/checkout`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_collection: 'always',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { supabaseUserId: user.id },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/checkout]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
