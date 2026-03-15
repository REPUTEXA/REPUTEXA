import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

/**
 * Crée une Stripe Checkout Session pour ajouter un établissement (quantité = actuelle + 1).
 * L'utilisateur voit la facture Stripe avec la remise dégressive appliquée sur la ligne.
 * Utilisé quand la limite d'établissements est atteinte (au lieu du Billing Portal).
 */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY non configuré' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const stripe = new Stripe(secretKey);
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;
    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun compte Stripe trouvé pour cet email' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Aucun abonnement actif. Utilisez le portail pour gérer votre abonnement.' },
        { status: 400 }
      );
    }

    const subscription = activeOrTrialing[0];
    const item = subscription.items?.data?.[0];
    if (!item?.price?.id) {
      return NextResponse.json(
        { error: 'Abonnement invalide (prix introuvable)' },
        { status: 400 }
      );
    }

    const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
    const newQty = Math.min(15, currentQty + 1);

    const priceId = item.price.id;
    const successUrl = `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=${subscription.metadata?.planSlug ?? 'pulse'}&status=establishment_added&flow=add-establishment`;
    const cancelUrl = `${baseUrl}/${locale}/dashboard/establishments`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: newQty,
        },
      ],
      subscription_data: {
        metadata: {
          planSlug: (subscription.metadata?.planSlug as string) ?? 'pulse',
          quantity: String(newQty),
          flow: 'add-establishment',
          previous_subscription_id: subscription.id,
        },
      },
      metadata: {
        planSlug: (subscription.metadata?.planSlug as string) ?? 'pulse',
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
    console.error('[stripe/create-checkout-session]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de la création de la session' },
      { status: 500 }
    );
  }
}
