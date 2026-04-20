import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { stripeBillingPortalHostedLocale } from '@/lib/services/billing-domain';

/**
 * GET /api/stripe/portal-redirect?locale=fr&flow=upgrade
 * Crée une session Portail Stripe (subscription_update) et redirige l'utilisateur.
 * Utilisé depuis les emails (TrialEndingSoon) et le bandeau dashboard.
 * Si non authentifié, redirige vers le dashboard pour se connecter.
 */
export async function GET(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.redirect(new URL('/fr/dashboard', getSiteUrl()));
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { searchParams: spEarly } = new URL(request.url);
    const queryLocaleEarly = spEarly.get('locale') ?? 'fr';

    if (!user?.email) {
      const locale = resolveStripePaymentLocaleFromRequest(request, { queryLocale: queryLocaleEarly });
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      return NextResponse.redirect(`${baseUrl}/${locale}/dashboard?action=choose_plan`);
    }

    const stripe = new Stripe(secretKey);
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single();
    const existingSubscriptionId = profile?.stripe_subscription_id as string | null | undefined;

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    const customerId = customers.data[0]?.id;

    if (!customerId) {
      const locale = resolveStripePaymentLocaleFromRequest(request, { queryLocale: queryLocaleEarly });
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      return NextResponse.redirect(`${baseUrl}/${locale}/dashboard?action=choose_plan`);
    }

    const { searchParams } = new URL(request.url);
    const flow = searchParams.get('flow');
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const appLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale') ?? queryLocaleEarly,
    });

    const isUpgradeFlow = flow === 'upgrade';
    const isAddEstablishmentFlow = flow === 'add-establishment';
    const returnUrl = isUpgradeFlow
      ? `${baseUrl}/${appLocale}/dashboard?status=upgraded`
      : isAddEstablishmentFlow
        ? `${baseUrl}/${appLocale}/dashboard/establishments?status=upgraded`
        : `${baseUrl}/${appLocale}/dashboard/settings?status=upgraded`;

    const portalStripeLocale = stripeBillingPortalHostedLocale(appLocale);
    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
      locale: portalStripeLocale,
    };

    if (isUpgradeFlow || isAddEstablishmentFlow) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });
      const activeOrTrialing = subscriptions.data.filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      );
      const subscription =
        existingSubscriptionId && activeOrTrialing.some((s) => s.id === existingSubscriptionId)
          ? activeOrTrialing.find((s) => s.id === existingSubscriptionId)
          : activeOrTrialing[0];
      if (subscription) {
        sessionParams.flow_data = {
          type: 'subscription_update',
          subscription_update: {
            subscription: subscription.id,
          },
        };
      }
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams);

    if (session.url) {
      return NextResponse.redirect(session.url);
    }

    return NextResponse.redirect(`${baseUrl}/${appLocale}/dashboard`);
  } catch (err) {
    console.error('[stripe/portal-redirect]', err);
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    return NextResponse.redirect(`${baseUrl}/fr/dashboard`);
  }
}
