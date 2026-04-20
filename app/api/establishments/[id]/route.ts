import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { toPlanSlug } from '@/lib/feature-gate';
import { getPriceAfterDiscount, PLAN_PRICES, getTotalMonthlyPrice } from '@/lib/establishments';

type Params = { params: Promise<{ id: string }> };

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

/**
 * Vérification systématique : chaque establishmentId doit appartenir à l'utilisateur (user_id).
 * Toutes les opérations ci-dessous utilisent .eq('user_id', user.id).
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const address = typeof body.address === 'string' ? body.address.trim() : undefined;

  const updates: Record<string, string | null | boolean> = {};
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address || null;
  // Quand l'utilisateur enregistre nom/adresse sur un slot "à configurer", on marque comme configuré
  if (name !== undefined || address !== undefined) updates.needs_configuration = false;

  if (Object.keys(updates).length === 0) {
    return apiJsonError(request, 'errors.noChangesToSave', 400);
  }

  const { data, error } = await supabase
    .from('establishments')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return apiJsonError(request, 'serverError', 500);
  if (!data) return apiJsonError(request, 'errors.establishmentNotFound', 404);

  return NextResponse.json({ ok: true, establishment: data });
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const { data: establishment, error: fetchError } = await supabase
    .from('establishments')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !establishment) {
    return apiJsonError(request, 'errors.establishmentNotFound', 404);
  }

  const { count: countBefore } = await supabase
    .from('establishments')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('establishments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return apiJsonError(request, 'serverError', 500);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const addonProductId = process.env.STRIPE_ADDON_PRODUCT_ID;
  let accessValidUntil: string | null = null;

  if (secretKey && addonProductId && user.email) {
    try {
      const stripe = new Stripe(secretKey);
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const customerId = customers.data[0]?.id;

      if (customerId) {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        });
        const sub = subscriptions.data[0];

        if (sub) {
          const periodEnd = (sub as { current_period_end?: number }).current_period_end;
          if (periodEnd) {
            accessValidUntil = new Date(periodEnd * 1000).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_plan, selected_plan')
            .eq('id', user.id)
            .single();

          const planSlug = toPlanSlug(
            profile?.subscription_plan ?? null,
            profile?.selected_plan ?? null
          );
          const basePrice = PLAN_PRICES[planSlug];
          const remainingAddons = (countBefore ?? 1) - 1;

          const productId = (p: { product?: string | { id?: string } }) =>
            typeof p.product === 'string' ? p.product : p.product?.id;
          const baseItems = sub.items.data.filter(
            (item) => productId(item.price) !== addonProductId
          );
          const addonItemsToRemove = sub.items.data.filter(
            (item) => productId(item.price) === addonProductId
          );
          const newAddonItems: { price: string; quantity: number }[] = [];

          for (let i = 1; i <= remainingAddons; i++) {
            const price = getPriceAfterDiscount(basePrice, i);
            const priceId = await getOrCreateAddonPrice(stripe, addonProductId, Math.round(price) * 100);
            if (priceId) newAddonItems.push({ price: priceId, quantity: 1 });
          }

          const updateItems: Stripe.SubscriptionUpdateParams.Item[] = [
            ...baseItems.map((item) => ({ id: item.id, quantity: item.quantity ?? 1 })),
            ...addonItemsToRemove.map((item) => ({ id: item.id, deleted: true })),
            ...newAddonItems.map((item) => ({ price: item.price, quantity: item.quantity })),
          ];

          await stripe.subscriptions.update(sub.id, {
            items: updateItems,
            proration_behavior: 'none', // Réduction appliquée au prochain cycle de facturation
          });
        }
      }
    } catch (e) {
      console.error('[establishments/DELETE] Stripe update', e);
    }
  }

  const { data: p } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan')
    .eq('id', user.id)
    .single();
  const planSlug = toPlanSlug(p?.subscription_plan ?? null, p?.selected_plan ?? null);
  const totalNextMonth = getTotalMonthlyPrice(planSlug, 1 + Math.max(0, (countBefore ?? 1) - 1));

  const { canSendEmail, sendEmail, DEFAULT_FROM } = await import('@/lib/resend');
  const { getEstablishmentDeletedEmailHtml } = await import('@/lib/emails/templates');
  const userEmail = user.email;
  if (canSendEmail() && userEmail) {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
    const html = getEstablishmentDeletedEmailHtml({
      establishmentName: establishment.name || 'Cet établissement',
      totalNextMonth,
      dashboardUrl: `${appUrl}/fr/dashboard/establishments`,
      accessValidUntil: accessValidUntil ?? undefined,
    });
    sendEmail({
      to: userEmail,
      subject: 'Établissement supprimé — REPUTEXA',
      html,
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
