import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { getSiteUrl } from '@/lib/site-url';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { stripeCheckoutHostedLocale, syncStripeCustomerPreferredLocales } from '@/lib/services/billing-domain';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/**
 * Paiement ponctuel : chevalet physique (prix dédié Stripe).
 * Sans STRIPE_PRICE_ID_COUNTER_STAND dans l'environnement, la route répond 503.
 */
export async function POST(request: Request) {
  try {
    const priceId = process.env.STRIPE_PRICE_ID_COUNTER_STAND?.trim();
    if (!priceId) {
      return apiJsonError(request, 'counterStandNotConfigured', 503);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiJsonError(request, 'stripeSecretNotConfigured', 500);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const paymentLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const { data: profile } = await supabase.from('profiles').select('language').eq('id', user.id).single();
    const customerEmailLocale = normalizeAppLocale((profile?.language as string) ?? paymentLocale);

    const stripe = new Stripe(secretKey);
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;
    if (!customerId) {
      return apiBillingJsonError(request, 'stripeCustomerNotFoundEmail', 400);
    }

    await syncStripeCustomerPreferredLocales(customerId, customerEmailLocale);

    const successUrl = `${baseUrl}/${paymentLocale}/dashboard/whatsapp-review?tab=flux&counter_stand=1`;
    const cancelUrl = `${baseUrl}/${paymentLocale}/dashboard/whatsapp-review?tab=flux`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      locale: stripeCheckoutHostedLocale(paymentLocale),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        kind: 'counter_stand',
        reputexaUserId: user.id,
      },
    });

    if (!session.url) {
      return apiBillingJsonError(request, 'checkoutSessionCreateFailed', 500);
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error('[create-counter-stand-checkout]', e);
    return apiBillingJsonError(request, 'checkoutFailed', 500);
  }
}
