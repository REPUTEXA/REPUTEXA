import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { toPlanSlug } from '@/lib/feature-gate';
import {
  getPriceAfterDiscount,
  PLAN_PRICES,
  getTotalMonthlyPrice,
} from '@/lib/establishments';

/** Retourne ou crée le Price Stripe pour l'addon (montant mensuel en centimes) */
async function getOrCreateAddonPrice(
  stripe: Stripe,
  productId: string,
  amountCents: number
): Promise<string | null> {
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
    limit: 100,
  });
  const match = existing.data.find(
    (p) => p.unit_amount === amountCents && p.recurring?.interval === 'month'
  );
  if (match) return match.id;
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: 'eur',
    recurring: { interval: 'month' },
  });
  return price.id;
}

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const addonProductId = process.env.STRIPE_ADDON_PRODUCT_ID;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : undefined;
    const googleLocationId = typeof body.googleLocationId === 'string' ? body.googleLocationId.trim() : undefined;
    const googleLocationName = typeof body.googleLocationName === 'string' ? body.googleLocationName.trim() : undefined;
    const googleLocationAddress = typeof body.googleLocationAddress === 'string' ? body.googleLocationAddress.trim() : undefined;

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Le nom de l'établissement est requis (min. 2 caractères)" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, selected_plan, subscription_status')
      .eq('id', user.id)
      .single();

    const planSlug = toPlanSlug(
      profile?.subscription_plan ?? null,
      profile?.selected_plan ?? null
    );

    const { count } = await supabase
      .from('establishments')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', user.id);

    const nextIndex = (count ?? 0) + 1; // index 0 = principal, 1 = 1er addon
    const basePrice = PLAN_PRICES[planSlug];
    const addonMonthlyPrice = getPriceAfterDiscount(basePrice, nextIndex);

    // Sécurité : n'insérer l'établissement QUE si le paiement est confirmé (ou si pas de Stripe).
    let needsPaymentRedirect = false;
    let invoiceUrl: string | null = null;
    let paymentConfirmed = false; // true uniquement si invoice.status === 'paid'

    const stripeRequired = Boolean(
      secretKey &&
      addonProductId &&
      profile?.subscription_status === 'active'
    );

    if (stripeRequired) {
      const stripe = new Stripe(secretKey!);
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      const customerId = customers.data[0]?.id;

      if (!customerId) {
        return NextResponse.json(
          { error: 'Compte de facturation introuvable. Contactez le support.' },
          { status: 400 }
        );
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
      const subscription = subscriptions.data[0];

      if (!subscription || subscription.status !== 'active') {
        return NextResponse.json(
          { error: 'Abonnement actif introuvable. Contactez le support.' },
          { status: 400 }
        );
      }

      const addonPriceId = await getOrCreateAddonPrice(
        stripe,
        addonProductId!,
        Math.round(addonMonthlyPrice) * 100
      );

      if (!addonPriceId) {
        return NextResponse.json(
          { error: 'Erreur de configuration tarifaire.' },
          { status: 500 }
        );
      }

      const pendingAddon = {
        userId: user.id,
        name,
        address: address || googleLocationAddress || null,
        googleLocationId: googleLocationId || null,
        googleLocationName: googleLocationName || null,
        googleLocationAddress: googleLocationAddress || null,
        displayOrder: count ?? 0,
      };

      // Métadonnées avant l'ajout pour que le webhook invoice.paid les trouve
      await stripe.subscriptions.update(subscription.id, {
        metadata: { pendingAddon: JSON.stringify(pendingAddon) },
      });

      try {
        // === Ajout via subscriptionItems.create : prélèvement immédiat au prorata ===
        await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: addonPriceId,
          quantity: 1,
          proration_behavior: 'always_invoice', // Facture proratisée immédiate + tentative de prélèvement
          payment_behavior: 'allow_incomplete', // Si 3DS ou carte refusée → invoice reste "open", on redirige
        });
      } catch (stripeErr) {
        await stripe.subscriptions.update(subscription.id, { metadata: { pendingAddon: '' } });
        const msg = stripeErr instanceof Error ? stripeErr.message : 'Erreur Stripe';
        return NextResponse.json(
          { error: msg.includes('card') || msg.includes('payment') ? 'Paiement refusé. Vérifiez votre carte ou contactez le support.' : `Erreur : ${msg}` },
          { status: 402 }
        );
      }

      const updated = await stripe.subscriptions.retrieve(subscription.id);
      const latestId = updated.latest_invoice;
      if (typeof latestId !== 'string') {
        return NextResponse.json(
          { error: 'Facture non créée. Réessayez ou contactez le support.' },
          { status: 500 }
        );
      }

      const inv = await stripe.invoices.retrieve(latestId);

      if (inv.status === 'paid') {
        paymentConfirmed = true; // Paiement immédiat réussi
      } else if (inv.status === 'open' && inv.hosted_invoice_url) {
        // 3DS / carte refusée → l'utilisateur doit payer via l'URL
        // L'établissement sera créé par le webhook invoice.paid
        needsPaymentRedirect = true;
        invoiceUrl = inv.hosted_invoice_url;
      } else {
        // Paiement refusé / carte refusée : ne pas activer l'établissement
        await stripe.subscriptions.update(subscription.id, { metadata: { pendingAddon: '' } }).catch(() => {});
        return NextResponse.json(
          { error: 'Paiement refusé. Vérifiez votre moyen de paiement (Paramètres) ou utilisez une autre carte. L\'établissement n\'a pas été activé.' },
          { status: 402 }
        );
      }
    } else {
      // Pas de Stripe (dev, trial, etc.) → on autorise l'insert direct
      paymentConfirmed = true;
    }

    if (needsPaymentRedirect && invoiceUrl) {
      return NextResponse.json({
        ok: true,
        needsPaymentRedirect: true,
        invoiceUrl,
        totalNextMonth: getTotalMonthlyPrice(planSlug, (count ?? 0) + 2),
      });
    }

    if (!paymentConfirmed) {
      return NextResponse.json(
        { error: 'Paiement non confirmé. Réessayez.' },
        { status: 402 }
      );
    }

    const displayOrder = count ?? 0;
    const { data: inserted, error } = await supabase
      .from('establishments')
      .insert({
        user_id: user.id,
        name,
        address: address || googleLocationAddress || null,
        google_location_id: googleLocationId || null,
        google_location_name: googleLocationName || null,
        google_location_address: googleLocationAddress || null,
        google_connected_at: googleLocationId ? new Date().toISOString() : null,
        display_order: displayOrder,
      })
      .select('id, name, address, display_order, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const totalNextMonth = getTotalMonthlyPrice(planSlug, (count ?? 0) + 2);

    // Email confirmation succès ajout (seulement si Stripe + paiement immédiat)
    const { canSendEmail, sendEmail, DEFAULT_FROM } = await import('@/lib/resend');
    const { getEstablishmentAddedEmailHtml } = await import('@/lib/emails/templates');
    if (secretKey && addonProductId && profile?.subscription_status === 'active' && canSendEmail()) {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
      const html = getEstablishmentAddedEmailHtml({
        establishmentName: name,
        totalNextMonth,
        dashboardUrl: `${appUrl}/fr/dashboard/establishments`,
      });
      sendEmail({
        to: user.email,
        subject: 'Nouvel établissement ajouté - Reputexa',
        html,
        from: process.env.RESEND_FROM ?? DEFAULT_FROM,
      }).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      establishment: inserted,
      needsPaymentRedirect: false,
      totalNextMonth,
    });
  } catch (err) {
    console.error('[establishments/add-with-payment]', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Erreur lors de l\'ajout',
      },
      { status: 500 }
    );
  }
}
