/**
 * Passage Mensuel → Annuel (Upsell) uniquement.
 *
 * Règle métier : on ne propose PAS de passage Annuel → Mensuel en self-service.
 * Raison : Stripe ne rembourse pas automatiquement la différence sur la carte en cas
 * de downgrade immédiat ; le prorata serait complexe (remboursement partiel). Un passage
 * au mensuel doit se faire via validation manuelle ou support (changement en fin de période
 * ou traitement au cas par cas). Il n'existe donc pas de route "switch-to-monthly".
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getPlanSlugFromSubscription, getSubscriptionInterval } from '@/lib/stripe-subscription';
import { getStripePriceId } from '@/config/pricing';
import type { PlanSlug } from '@/config/pricing';

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

    if (getSubscriptionInterval(active) === 'year') {
      return NextResponse.json(
        { error: 'Vous êtes déjà en facturation annuelle.' },
        { status: 400 }
      );
    }

    const planSlug = getPlanSlugFromSubscription(active) as PlanSlug | null;
    if (!planSlug) {
      return NextResponse.json(
        { error: 'Plan non reconnu' },
        { status: 400 }
      );
    }

    const annualPriceId = getStripePriceId(planSlug, true);
    if (!annualPriceId) {
      return NextResponse.json(
        { error: 'Tarif annuel non configuré pour ce plan' },
        { status: 500 }
      );
    }

    const item = active.items?.data?.[0];
    if (!item?.id) {
      return NextResponse.json(
        { error: 'Abonnement invalide' },
        { status: 400 }
      );
    }

    const quantity = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;

    const updated = await stripe.subscriptions.update(active.id, {
      items: [{ id: item.id, price: annualPriceId, quantity }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
    });

    const latestInvoiceId =
      typeof updated.latest_invoice === 'string'
        ? updated.latest_invoice
        : updated.latest_invoice?.id;

    if (!latestInvoiceId) {
      return NextResponse.json({ url: null, message: 'Mise à jour effectuée.' });
    }

    const invoice = await stripe.invoices.retrieve(latestInvoiceId);
    if (invoice.status === 'paid') {
      return NextResponse.json({ url: null, message: 'Déjà réglé.' });
    }
    if (invoice.hosted_invoice_url) {
      return NextResponse.json({ url: invoice.hosted_invoice_url });
    }

    return NextResponse.json({ url: null });
  } catch (err) {
    console.error('[stripe/switch-to-annual]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur' },
      { status: 500 }
    );
  }
}
