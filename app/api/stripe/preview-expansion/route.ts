/**
 * Aperçu du prorata d'expansion sans modifier l'abonnement.
 * Retourne le montant dû (Stripe) pour +N établissements.
 * Zéro risque : aucun changement côté Stripe.
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSubscriptionInterval } from '@/lib/stripe-subscription';

export async function GET(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe non configuré' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const expansionAddCount = Math.min(
      15,
      Math.max(1, Math.floor(Number(searchParams.get('expansionAddCount')) || 0)
    );
    if (expansionAddCount < 1) {
      return NextResponse.json(
        { error: 'expansionAddCount requis (1-15)' },
        { status: 400 }
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
        { error: 'Aucun compte Stripe trouvé' },
        { status: 400 }
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const active = subscriptions.data.find(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (!active) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif' },
        { status: 400 }
      );
    }

    const item = active.items?.data?.[0];
    if (!item?.id) {
      return NextResponse.json(
        { error: 'Abonnement invalide' },
        { status: 400 }
      );
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
      upcoming = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
        subscription: active.id,
        subscription_items: [{ id: item.id, quantity: newQty }],
      } as Stripe.InvoiceRetrieveUpcomingParams);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
