import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { createBulkExpansionBodySchema } from '@/lib/validations/stripe';
import { stripeWithRetry } from '@/lib/stripe-client';

/**
 * Expansion multi-établissements. Quantité réelle lue depuis Stripe.
 * Prorata 100% géré par Stripe (hosted_invoice_url). Pas de mise à jour DB ici : webhook invoice.paid / subscription.updated.
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

    const rawBody = await request.json().catch(() => ({}));
    const parsed = createBulkExpansionBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'expansionAddCount (1-15) est requis.' },
        { status: 400 }
      );
    }
    const { expansionAddCount } = parsed.data;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const successUrl = `${baseUrl}/${locale}/dashboard/establishments?status=upgraded&openConfig=1`;

    const customers = await stripeWithRetry(
      (s) => s.customers.list({ email: user.email, limit: 1 }),
      secretKey
    );
    const customerId = customers.data[0]?.id;
    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun compte Stripe trouvé pour cet email' },
        { status: 400 }
      );
    }

    const subscriptions = await stripeWithRetry(
      (s) => s.subscriptions.list({ customer: customerId, status: 'all', limit: 10 }),
      secretKey
    );
    const activeOrTrialing = subscriptions.data.filter(
      (s) => s.status === 'active' || s.status === 'trialing'
    );
    if (activeOrTrialing.length === 0) {
      return NextResponse.json(
        { error: 'Aucun abonnement actif.' },
        { status: 400 }
      );
    }

    const subscriptionFromList = activeOrTrialing[0];
    const subscriptionId = subscriptionFromList.id;

    const subscription = await stripeWithRetry(
      (s) => s.subscriptions.retrieve(subscriptionId),
      secretKey
    );
    const item = subscription.items?.data?.[0];
    if (!item?.id || !item?.price?.id) {
      return NextResponse.json(
        { error: 'Abonnement invalide (item introuvable)' },
        { status: 400 }
      );
    }

    const currentStripeQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
    const newTotalQuantity = Math.min(15, currentStripeQty + expansionAddCount);

    if (newTotalQuantity <= currentStripeQty) {
      return NextResponse.json(
        {
          error: `La quantité cible (${newTotalQuantity}) doit être supérieure à la quantité actuelle (${currentStripeQty}).`,
        },
        { status: 400 }
      );
    }

    const updated = await stripeWithRetry(
      (s) =>
        s.subscriptions.update(subscriptionId, {
          items: [{ id: item.id, quantity: newTotalQuantity }],
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
      return NextResponse.json({ url: successUrl });
    }

    const invoice = await stripeWithRetry(
      (s) => s.invoices.retrieve(latestInvoiceId),
      secretKey
    );
    if (invoice.status === 'paid') {
      return NextResponse.json({ url: successUrl });
    }
    // IMPORTANT : renvoyer l'URL de la facture Stripe pour que le front fasse un vrai paiement.
    if (invoice.hosted_invoice_url) {
      return NextResponse.json({ url: invoice.hosted_invoice_url });
    }

    return NextResponse.json({ url: successUrl });
  } catch (err) {
    console.error('[stripe/create-bulk-expansion]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'expansion' },
      { status: 500 }
    );
  }
}
