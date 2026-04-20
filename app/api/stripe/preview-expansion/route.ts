/**
 * Aperçu du prorata d'expansion sans modifier l'abonnement.
 * Retourne le montant dû (Stripe) pour +N établissements. Zéro risque : aucun changement côté Stripe.
 * Tous les appels Stripe passent par stripeWithRetry. Email utilisateur validé avant tout appel.
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionInterval } from '@/lib/stripe-subscription';
import { stripeWithRetry } from '@/lib/stripe-client';
import { findCustomerIdByEmail, findActiveSubscriptionForCustomer } from '@/lib/services/billing-domain';

export async function GET(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiBillingJsonError(request, 'stripeNotConfigured', 500);
    }

    const { searchParams } = new URL(request.url);
    const expansionAddCount = Math.min(
      15,
      Math.max(1, Math.floor(Number(searchParams.get('expansionAddCount')) || 0))
    );
    if (expansionAddCount < 1) {
      return apiBillingJsonError(request, 'expansionAddCountRequired', 400);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email?.trim()) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const email = user.email.trim().toLowerCase();
    const customerId = await findCustomerIdByEmail(email);
    if (!customerId) {
      return apiBillingJsonError(request, 'stripeCustomerNotFound', 400);
    }

    const active = await findActiveSubscriptionForCustomer(customerId);
    if (!active) {
      return apiBillingJsonError(request, 'noActiveSubscription', 400);
    }

    const item = active.items?.data?.[0];
    if (!item?.id) {
      return apiBillingJsonError(request, 'invalidSubscriptionItem', 400);
    }

    const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
    const newQty = Math.min(15, currentQty + expansionAddCount);
    if (newQty <= currentQty) {
      return NextResponse.json(
        { amountDue: 0, currency: 'eur', prorataAmount: 0 }
      );
    }

    let upcoming: Stripe.Invoice;
    try {
      upcoming = await stripeWithRetry(
        (s) =>
          (s.invoices as unknown as { retrieveUpcoming: (params: Record<string, unknown>) => Promise<Stripe.Invoice> }).retrieveUpcoming({
            customer: customerId,
            subscription: active.id,
            subscription_items: [{ id: item.id, quantity: newQty }],
          }),
        secretKey
      );
    } catch (previewErr) {
      console.warn('[stripe/preview-expansion] retrieveUpcoming failed', previewErr);
      return NextResponse.json({
        amountDue: null,
        currency: 'eur',
        currentQuantity: currentQty,
        newQuantity: newQty,
        expansionAddCount,
        interval: getSubscriptionInterval(active),
      });
    }

    const amountDue = upcoming.amount_due ?? 0;
    const currency = (upcoming.currency ?? 'eur') as string;
    const interval = getSubscriptionInterval(active);

    return NextResponse.json({
      amountDue: amountDue / 100,
      amountDueCents: amountDue,
      currency,
      currentQuantity: currentQty,
      newQuantity: newQty,
      expansionAddCount,
      interval,
    });
  } catch (err) {
    console.error('[stripe/preview-expansion]', err);
    return apiBillingJsonError(request, 'previewExpansionFailed', 500);
  }
}
// Build trigger: 2026-03-20
