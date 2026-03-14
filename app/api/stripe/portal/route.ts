import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

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
        { error: 'Aucun compte de facturation trouvé' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const flow = searchParams.get('flow');
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

    const isUpgradeFlow = flow === 'upgrade';
    const returnUrl = isUpgradeFlow
      ? `${baseUrl}/${locale}/dashboard?status=upgraded`
      : `${baseUrl}/${locale}/dashboard/settings`;

    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
    };

    if (isUpgradeFlow) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 5,
      });
      const subscription = subscriptions.data.find(
        (s) => s.status === 'active' || s.status === 'trialing'
      );
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du portail' },
      { status: 500 }
    );
  }
}
