import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

const TRIAL_DAYS = 14;

const PLAN_TO_PRICE_ENV: Record<string, string> = {
  vision: 'STRIPE_PRICE_ID_VISION',
  pulse: 'STRIPE_PRICE_ID_PULSE',
  zenith: 'STRIPE_PRICE_ID_ZENITH',
  'zenith-trial': 'STRIPE_PRICE_ID_ZENITH',
  starter: 'STRIPE_PRICE_ID_VISION',
  manager: 'STRIPE_PRICE_ID_PULSE',
  dominator: 'STRIPE_PRICE_ID_ZENITH',
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

    const stripe = new Stripe(secretKey);
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const planType = searchParams.get('planType') ?? 'manager';
    const planSlug = (searchParams.get('planSlug') ?? (planType === 'dominator' ? 'zenith' : planType === 'manager' ? 'pulse' : 'vision')) as string;
    const skipTrial = searchParams.get('skipTrial') === '1' || searchParams.get('skipTrial') === 'true';
    const isZenithTrial = planSlug === 'zenith-trial';
    const effectivePlanSlug = isZenithTrial ? 'zenith' : planSlug;
    const baseUrl = getSiteUrl();

    const priceId = process.env[PLAN_TO_PRICE_ENV[planSlug] ?? PLAN_TO_PRICE_ENV.pulse];

    if (!priceId) {
      return NextResponse.json(
        { error: 'STRIPE_PRICE_ID_VISION, STRIPE_PRICE_ID_PULSE ou STRIPE_PRICE_ID_ZENITH requis' },
        { status: 500 }
      );
    }

    let customerEmail = '';
    let customerId: string | null = null;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    customerEmail = user.email;
    const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
    customerId = existing.data[0]?.id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: customerEmail,
        metadata: { supabaseUserId: user.id },
      });
      customerId = customer.id;
    }

    const successUrl = isZenithTrial
      ? `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=zenith&status=trial_started`
      : `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=${effectivePlanSlug}&status=success`;
    const cancelUrl = `${baseUrl}/${locale}/choose-plan?error=payment_cancelled`;

    const lineItems: Stripe.Checkout.SessionCreateParams['line_items'] = [
      { price: priceId, quantity: 1 },
    ];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_collection: 'always',
      ...(customerId
        ? { customer: customerId }
        : { customer_email: customerEmail }),
      line_items: lineItems,
      subscription_data: {
        metadata: { planSlug: effectivePlanSlug },
        ...(isZenithTrial ? { trial_period_days: TRIAL_DAYS } : (skipTrial ? {} : { trial_period_days: TRIAL_DAYS })),
      },
      metadata: { planSlug: effectivePlanSlug },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/create-checkout]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
