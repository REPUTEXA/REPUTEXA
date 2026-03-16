/**
 * Passage Mensuel → Annuel (Upsell) uniquement.
 * Règle métier : pas de passage Annuel → Mensuel en self-service (Stripe ne rembourse pas la différence automatiquement).
 * Tous les appels Stripe passent par stripeWithRetry. Email utilisateur validé avant tout appel.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanSlugFromSubscription, getSubscriptionInterval } from '@/lib/stripe-subscription';
import { getStripePriceId } from '@/config/pricing';
import { stripeWithRetry } from '@/lib/stripe-client';
import { findCustomerIdByEmail, findActiveSubscriptionForCustomer } from '@/lib/services/billing-domain';
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
    if (!user?.email?.trim()) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    const customerId = await findCustomerIdByEmail(email);
    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun compte Stripe trouvé' },
        { status: 400 }
      );
    }

    const active = await findActiveSubscriptionForCustomer(customerId);
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

    const updated = await stripeWithRetry(
      (s) =>
        s.subscriptions.update(active.id, {
          items: [{ id: item.id, price: annualPriceId, quantity }],
          proration_behavior: 'always_invoice',
          payment_behavior: 'pending_if_incomplete',
        }),
      secretKey
    );

    const latestInvoiceId =
      typeof updated.latest_invoice === 'string'
        ? updated.latest_invoice
        : updated.latest_invoice?.id;

    if (!latestInvoiceId) {
      return NextResponse.json({ url: null, message: 'Mise à jour effectuée.' });
    }

    const invoice = await stripeWithRetry((s) => s.invoices.retrieve(latestInvoiceId), secretKey);
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
