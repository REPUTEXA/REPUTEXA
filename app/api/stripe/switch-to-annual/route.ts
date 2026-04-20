/**
 * Passage Mensuel → Annuel (Upsell) uniquement.
 * Règle métier : pas de passage Annuel → Mensuel en self-service (Stripe ne rembourse pas la différence automatiquement).
 * Tous les appels Stripe passent par stripeWithRetry. Email utilisateur validé avant tout appel.
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createClient } from '@/lib/supabase/server';
import {
  billingCurrencyFromSubscription,
  getPlanSlugFromSubscription,
  getSubscriptionInterval,
} from '@/lib/stripe-subscription';
import { getStripePriceId } from '@/config/pricing';
import { stripeWithRetry } from '@/lib/stripe-client';
import { findCustomerIdByEmail, findActiveSubscriptionForCustomer } from '@/lib/services/billing-domain';
import type { PlanSlug } from '@/config/pricing';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiBillingJsonError(request, 'stripeNotConfigured', 500);
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

    if (getSubscriptionInterval(active) === 'year') {
      return apiBillingJsonError(request, 'alreadyAnnualBilling', 400);
    }

    const planSlug = getPlanSlugFromSubscription(active) as PlanSlug | null;
    if (!planSlug) {
      return apiBillingJsonError(request, 'planNotRecognized', 400);
    }

    const annualPriceId = getStripePriceId(planSlug, true, billingCurrencyFromSubscription(active));
    if (!annualPriceId) {
      return apiBillingJsonError(request, 'annualPriceNotConfigured', 500);
    }

    const item = active.items?.data?.[0];
    if (!item?.id) {
      return apiBillingJsonError(request, 'invalidSubscriptionItem', 400);
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
      const t = createServerTranslator('Api', apiLocaleFromRequest(request));
      return NextResponse.json({
        url: null,
        message: t('errors.billing.switchAnnualUpdated'),
      });
    }

    const invoice = await stripeWithRetry((s) => s.invoices.retrieve(latestInvoiceId), secretKey);
    if (invoice.status === 'paid') {
      const tPaid = createServerTranslator('Api', apiLocaleFromRequest(request));
      return NextResponse.json({ url: null, message: tPaid('errors.billing.switchAnnualAlreadyPaid') });
    }
    if (invoice.hosted_invoice_url) {
      return NextResponse.json({ url: invoice.hosted_invoice_url });
    }

    return NextResponse.json({ url: null });
  } catch (err) {
    console.error('[stripe/switch-to-annual]', err);
    return apiBillingJsonError(request, 'switchAnnualGeneric', 500);
  }
}
