import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';

/**
 * Met à jour la quantité de l'abonnement Stripe existant (ajout d'établissements en lot).
 * Utilise proration_behavior: 'always_invoice' pour générer une facture au prorata.
 * Redirige l'utilisateur vers la page de paiement Stripe (hosted_invoice_url) pour régler la facture.
 */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiJsonError(request, 'stripeSecretNotConfigured', 500);
    }

    let body: { targetQuantity?: number } = {};
    try {
      body = await request.json();
    } catch {
      return apiJsonError(request, 'invalidJson', 400);
    }

    const targetQuantity = Math.min(15, Math.max(1, Number(body.targetQuantity) || 1));

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const stripe = new Stripe(secretKey);
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const { searchParams } = new URL(request.url);
    const locale = normalizeAppLocale(
      resolveStripePaymentLocaleFromRequest(request, { queryLocale: searchParams.get('locale') })
    );
    const successUrl = `${baseUrl}/${locale}/dashboard?status=upgraded&showUpdates=true`;

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;
    if (!customerId) {
      return apiBillingJsonError(request, 'stripeCustomerNotFoundEmail', 400);
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const activeOrTrialing = subscriptions.data.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (activeOrTrialing.length === 0) {
      return apiBillingJsonError(request, 'noActiveSubscription', 400);
    }

    const subscription = activeOrTrialing[0];
    const item = subscription.items?.data?.[0];
    if (!item?.id || !item?.price?.id) {
      return apiBillingJsonError(request, 'invalidSubscriptionItem', 400);
    }

    const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
    if (targetQuantity <= currentQty) {
      return apiBillingJsonError(request, 'quantityTargetMustExceedCurrent', 400);
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, quantity: targetQuantity }],
      proration_behavior: 'always_invoice',
    });

    const latestInvoiceId =
      typeof updated.latest_invoice === 'string'
        ? updated.latest_invoice
        : updated.latest_invoice?.id;

    if (!latestInvoiceId) {
      return NextResponse.json({ url: successUrl });
    }

    const invoice = await stripe.invoices.retrieve(latestInvoiceId);
    if (invoice.status === 'paid') {
      return NextResponse.json({ url: successUrl });
    }
    if (invoice.hosted_invoice_url) {
      return NextResponse.json({ url: invoice.hosted_invoice_url });
    }

    return NextResponse.json({ url: successUrl });
  } catch (err) {
    console.error('[stripe/create-bulk-session]', err);
    return apiBillingJsonError(request, 'bulkSessionUpdateFailed', 500);
  }
}
