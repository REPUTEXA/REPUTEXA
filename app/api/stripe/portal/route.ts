/**
 * POST /api/stripe/portal
 * Crée une session du Customer Portal (changer de plan / réduire quota).
 * Délègue au BillingDomainService. Email utilisateur validé avant tout appel Stripe.
 */

import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { createPortalSession, findCustomerIdByEmail, findActiveSubscriptionForCustomer } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const email = user.email.trim().toLowerCase();
    const { searchParams } = new URL(request.url);
    const userLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const customerId = await findCustomerIdByEmail(email);

    if (!customerId) {
      return apiBillingJsonError(request, 'billingAccountNotFound', 400);
    }

    const flow = searchParams.get('flow');
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

    const isUpgradeFlow = flow === 'upgrade';
    const isAddEstablishmentFlow = flow === 'add-establishment';
    const isReduceQuotaFlow = flow === 'reduce-quota';

    const returnUrl = isUpgradeFlow
      ? `${baseUrl}/api/stripe/sync-after-portal?locale=${userLocale}&flow=upgrade`
      : isAddEstablishmentFlow
        ? `${baseUrl}/api/stripe/sync-after-portal?locale=${userLocale}&flow=add-establishment`
        : isReduceQuotaFlow
          ? `${baseUrl}/${userLocale}/dashboard/establishments?return_flow=reduce`
          : `${baseUrl}/api/stripe/sync-after-portal?locale=${userLocale}&flow=upgrade`;

    let subscriptionId: string | undefined;
    if (isUpgradeFlow || isAddEstablishmentFlow) {
      const sub = await findActiveSubscriptionForCustomer(customerId);
      subscriptionId = sub?.id;
    }

    const { url } = await createPortalSession({
      customerId,
      returnUrl,
      subscriptionId,
      locale: userLocale,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return apiBillingJsonError(request, 'portalOpenFailed', 500);
  }
}
