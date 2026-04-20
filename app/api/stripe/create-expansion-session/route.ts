/**
 * POST /api/stripe/create-expansion-session
 * Crée une session du Billing Portal avec un flow "subscription_update_confirm"
 * pour augmenter la quantité (nombre d'établissements) de +1.
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { findCustomerIdByEmail, stripeBillingPortalHostedLocale } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiBillingJsonError(request, 'stripeNotConfigured', 500);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.trim()) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const email = user.email.trim().toLowerCase();
    const customerId = await findCustomerIdByEmail(email);
    if (!customerId) {
      return apiBillingJsonError(request, 'billingAccountNotFound', 400);
    }

    const stripe = new Stripe(secretKey);

    // Abonnement actif du client via subscriptions.list
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const activeSub =
      subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ??
      subs.data[0];
    if (!activeSub) {
      return apiBillingJsonError(request, 'noActiveSubscription', 400);
    }

    const firstItem = activeSub.items.data[0];
    if (!firstItem?.id) {
      return apiBillingJsonError(request, 'invalidSubscriptionNoItem', 400);
    }

    const currentQty =
      typeof firstItem.quantity === 'number' && firstItem.quantity >= 1
        ? firstItem.quantity
        : 1;
    const newQuantity = currentQty + 1;

    const { searchParams } = new URL(request.url);
    const appLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const returnUrl = `${baseUrl}/${appLocale}/dashboard/establishments`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      locale: stripeBillingPortalHostedLocale(appLocale),
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: {
          subscription: activeSub.id,
          items: [
            {
              id: firstItem.id,
              quantity: newQuantity,
            },
          ],
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/create-expansion-session]', err);
    return apiBillingJsonError(request, 'expansionSessionCreateFailed', 500);
  }
}

