/**
 * sync-profile : point d'entrée unique après succès Checkout Stripe.
 *
 * GET (redirection Stripe) : récupère la session, sync le profil via BillingDomainService,
 * puis redirige vers /dashboard?status=success (ou trial_started) pour afficher le SuccessPaymentToast.
 * POST : idem pour appels programmatiques (body JSON session_id).
 */

import { NextResponse } from 'next/server';
import { getSiteUrl } from '@/lib/site-url';
import { syncProfileBodySchema } from '@/lib/validations/stripe';
import { stripeWithRetry } from '@/lib/stripe-client';
import { syncProfileFromSubscription, retrieveSubscription, revalidateDashboardPaths, revalidateFullApp } from '@/lib/services/billing-domain';

async function syncProfileFromSessionId(sessionId: string): Promise<{ planSlug?: string; status: 'success' | 'trial_started' }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('Stripe not configured');

  const session = await stripeWithRetry(
    (s) => s.checkout.sessions.retrieve(sessionId, { expand: ['customer', 'subscription'] }),
    secretKey
  );

  const customer = session.customer as { id?: string; email?: string } | null;
  const customerEmail =
    (typeof customer === 'object' && customer?.email) ||
    session.customer_details?.email?.trim() ||
    '';
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;

  if (!customerEmail) throw new Error('No customer email');
  if (!subscriptionId) throw new Error('No subscription on session');

  const subscription = await retrieveSubscription(subscriptionId);
  await syncProfileFromSubscription(subscription, customerEmail);
  revalidateDashboardPaths();
  revalidateFullApp();

  const planSlug = (session.metadata?.planSlug ?? 'pulse') as string;
  const status = subscription.status === 'trialing' ? 'trial_started' : 'success';
  return { planSlug, status };
}

/** GET : redirection post-paiement Stripe → sync puis redirect /dashboard?status=success */
export async function GET(request: Request) {
  const baseUrl = getSiteUrl().replace(/\/+$/, '');
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id')?.trim() ?? '';
  const locale = searchParams.get('locale') ?? 'fr';

  const dashboardUrl = `${baseUrl}/${locale}/dashboard`;

  if (!sessionId) {
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const { planSlug, status } = await syncProfileFromSessionId(sessionId);
    const redirectUrl = `${dashboardUrl}?status=${status}${planSlug ? `&plan=${planSlug}` : ''}`;
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[stripe/sync-profile GET]', error);
    return NextResponse.redirect(dashboardUrl);
  }
}

/** POST : sync depuis un session_id (body JSON), pour appels programmatiques */
export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = syncProfileBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'session_id required' }, { status: 400 });
    }
    const { session_id: sessionId } = parsed.data;

    await syncProfileFromSessionId(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[stripe/sync-profile POST]', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
