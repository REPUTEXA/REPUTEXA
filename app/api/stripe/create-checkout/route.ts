import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { getStripePriceId, type PlanSlug } from '@/config/pricing';
import { createCheckoutQuerySchema, getQueryFromRequest } from '@/lib/validations/stripe';
import { stripeWithRetry, getStripe } from '@/lib/stripe-client';

const TRIAL_DAYS = 14;

const LEGACY_PLAN_MAP: Record<string, PlanSlug> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
  'zenith-trial': 'zenith',
  starter: 'vision',
  manager: 'pulse',
  dominator: 'zenith',
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

    const parsed = createCheckoutQuerySchema.safeParse(getQueryFromRequest(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { locale, planSlug: rawPlanSlug, skipTrial, annual, quantity: rawQty } = parsed.data;
    const planType = new URL(request.url).searchParams.get('planType') ?? 'manager';
    const planSlug = (rawPlanSlug ?? (planType === 'dominator' ? 'zenith' : planType === 'manager' ? 'pulse' : 'vision')) as string;
    const quantity = typeof rawQty === 'number' ? rawQty : Math.min(15, Math.max(1, parseInt(String(rawQty ?? '1'), 10) || 1));
    const isZenithTrial = planSlug === 'zenith-trial';
    const effectivePlanSlug = isZenithTrial ? 'zenith' : (LEGACY_PLAN_MAP[planSlug] ?? 'pulse');
    const baseUrl = getSiteUrl();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let customerId: string | null = null;
    await stripeWithRetry(async (s) => {
      const existingCustomers = await s.customers.list({ email: user.email, limit: 1 });
      customerId = existingCustomers.data[0]?.id ?? null;
    }, secretKey);

    // Politique d'abonnement unique : si déjà abonné (actif/trialing), rediriger vers le portail pour éviter les doublons
    if (customerId) {
      const existingSub = await stripeWithRetry(async (s) => {
        const subscriptions = await s.subscriptions.list({
          customer: customerId!,
          status: 'all',
          limit: 5,
        });
        return subscriptions.data.find((sub) => sub.status === 'active' || sub.status === 'trialing') ?? null;
      }, secretKey);
      if (existingSub) {
        const returnUrl = `${baseUrl.replace(/\/+$/, '')}/${locale}/dashboard?status=upgraded`;
        const portalSession = await stripeWithRetry(
          (s) =>
            s.billingPortal.sessions.create({
              customer: customerId!,
              return_url: returnUrl,
              flow_data: {
                type: 'subscription_update',
                subscription_update: { subscription: existingSub.id },
              },
            }),
          secretKey
        );
        return NextResponse.json({ url: portalSession.url, redirectToPortal: true });
      }
    }

    const priceId = getStripePriceId(effectivePlanSlug, annual);

    if (!priceId) {
      const msg = annual
        ? 'Tarif annuel non configuré pour ce plan. Vérifiez STRIPE_PRICE_ID_*_ANNUAL dans .env ou contactez le support.'
        : 'STRIPE_PRICE_ID_* (Vision/Pulse/Zenith) requis. Vérifiez config/pricing.ts et .env.';
      return NextResponse.json(
        { error: msg },
        { status: 500 }
      );
    }

    if (!customerId) {
      const customer = await stripeWithRetry(
        (s) =>
          s.customers.create({
            email: user.email,
            metadata: { supabaseUserId: user.id },
          }),
        secretKey
      );
      customerId = customer.id;
    }
    const customerEmail = user.email;

    const successUrl = isZenithTrial
      ? `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=zenith&status=trial_started`
      : `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=${effectivePlanSlug}&status=success`;
    const cancelUrl = `${baseUrl}/${locale}/pricing?plan=${effectivePlanSlug}&annual=${annual ? '1' : '0'}&status=cancelled`;

    // IDs de prix échelonnés (Tiers) : proration Stripe automatique au changement de plan ou quantité
    const lineItems: Stripe.Checkout.SessionCreateParams['line_items'] = [
      {
        price: priceId,
        quantity,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 15 },
      },
    ];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_collection: 'always',
      ...(customerId
        ? { customer: customerId }
        : { customer_email: customerEmail }),
      line_items: lineItems,
      subscription_data: {
        metadata: { planSlug: effectivePlanSlug, quantity: String(quantity) },
        ...(isZenithTrial ? { trial_period_days: TRIAL_DAYS } : (skipTrial ? {} : { trial_period_days: TRIAL_DAYS })),
      },
      metadata: { planSlug: effectivePlanSlug, quantity: String(quantity) },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    };

    const session = await stripeWithRetry((s) => s.checkout.sessions.create(sessionParams), secretKey);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/create-checkout]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
