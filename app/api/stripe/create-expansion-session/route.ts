/**
 * POST /api/stripe/create-expansion-session
 * Crée une session du Billing Portal avec un flow "subscription_update_confirm"
 * pour augmenter la quantité (nombre d'établissements) de +1.
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { findCustomerIdByEmail } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe non configuré' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.trim()) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    const customerId = await findCustomerIdByEmail(email);
    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun compte de facturation trouvé' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Aucun abonnement actif' },
        { status: 400 }
      );
    }

    const firstItem = activeSub.items.data[0];
    if (!firstItem?.id) {
      return NextResponse.json(
        { error: 'Abonnement invalide (aucun item)' },
        { status: 400 }
      );
    }

    const currentQty =
      typeof firstItem.quantity === 'number' && firstItem.quantity >= 1
        ? firstItem.quantity
        : 1;
    const newQuantity = currentQty + 1;

    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get('locale') ?? 'fr';
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const returnUrl = `${baseUrl}/${localeParam}/dashboard/establishments`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
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
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Erreur lors de la création de la session d’expansion',
      },
      { status: 500 }
    );
  }
}

