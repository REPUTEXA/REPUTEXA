import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { stripeCheckoutHostedLocale, syncStripeCustomerPreferredLocales } from '@/lib/services/billing-domain';

/**
 * Crée une Stripe Checkout Session pour ajouter un établissement (quantité = actuelle + 1).
 * Remplace le Billing Portal pour cet usage : sur la page Checkout, l'utilisateur voit
 * le prix ajusté grâce aux Graduated Tiers configurés sur le prix Stripe.
 */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiJsonError(request, 'stripeSecretNotConfigured', 500);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const paymentLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const { data: profile } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .single();
    const customerEmailLocale = normalizeAppLocale((profile?.language as string) ?? paymentLocale);
    const appLocale = paymentLocale;

    const stripe = new Stripe(secretKey);
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;
    if (!customerId) {
      return apiBillingJsonError(request, 'stripeCustomerNotFoundEmail', 400);
    }

    await syncStripeCustomerPreferredLocales(customerId, customerEmailLocale);

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const activeOrTrialing = subscriptions.data.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (activeOrTrialing.length === 0) {
      return apiBillingJsonError(request, 'noActiveSubscriptionPortalHint', 400);
    }

    const subscription = activeOrTrialing[0];
    const item = subscription.items?.data?.[0];
    if (!item?.price?.id) {
      return apiBillingJsonError(request, 'invalidSubscriptionPrice', 400);
    }

    const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
    const newQty = Math.min(15, currentQty + 1);

    const priceId = item.price.id;
    const planSlug = (subscription.metadata?.planSlug as string) ?? 'pulse';
    const successUrl = `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${appLocale}&plan=${planSlug}&status=upgraded&showUpdates=true&flow=add-establishment`;
    const cancelUrl = `${baseUrl}/${appLocale}/dashboard/establishments`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      locale: stripeCheckoutHostedLocale(appLocale),
      line_items: [
        {
          price: priceId,
          quantity: newQty,
        },
      ],
      subscription_data: {
        metadata: {
          planSlug,
          quantity: String(newQty),
          flow: 'add-establishment',
          previous_subscription_id: subscription.id,
        },
      },
      metadata: {
        planSlug,
        quantity: String(newQty),
        flow: 'add-establishment',
        previous_subscription_id: subscription.id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/create-add-establishment-session]', err);
    return apiBillingJsonError(request, 'addEstablishmentSessionFailed', 500);
  }
}
