/**
 * GET /api/stripe/sync-after-portal
 * Retour du portail Stripe (changement de plan / ajout établissement).
 * Sync forcé : retrieve subscription en direct (pas de cache), mise à jour Supabase, puis redirect dashboard.
 * Objectif : au clic sur "Continuer" chez Stripe, l'utilisateur voit son nouveau plan immédiatement.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import {
  findCustomerIdByEmail,
  findActiveSubscriptionForCustomer,
  retrieveSubscription,
  syncProfileFromSubscription,
  revalidateDashboardPaths,
  revalidateFullApp,
} from '@/lib/services/billing-domain';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const baseUrl = getSiteUrl().replace(/\/+$/, '');
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get('locale') ?? 'fr';
  const flow = searchParams.get('flow') ?? 'upgrade';

  const dashboardUrl = `${baseUrl}/${locale}/dashboard`;
  const establishmentsUrl = `${baseUrl}/${locale}/dashboard/establishments`;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return NextResponse.redirect(dashboardUrl);
    }

    const email = user.email.trim().toLowerCase();
    const customerId = await findCustomerIdByEmail(email);
    if (!customerId) {
      return NextResponse.redirect(flow === 'add-establishment' ? establishmentsUrl : dashboardUrl);
    }

    const sub = await findActiveSubscriptionForCustomer(customerId);
    if (!sub) {
      return NextResponse.redirect(flow === 'add-establishment' ? establishmentsUrl : dashboardUrl);
    }

    const subscriptionLive = await retrieveSubscription(sub.id);
    await syncProfileFromSubscription(subscriptionLive, email);
    revalidateDashboardPaths();
    revalidateFullApp();

    const redirectUrl =
      flow === 'add-establishment'
        ? `${establishmentsUrl}?status=upgraded&showUpdates=true`
        : `${dashboardUrl}?status=upgraded&showUpdates=true`;

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('[stripe/sync-after-portal]', err);
    const fallback = flow === 'add-establishment' ? establishmentsUrl : dashboardUrl;
    return NextResponse.redirect(fallback);
  }
}
