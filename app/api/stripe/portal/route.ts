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

    // Politique d'abonnement unique : si le profil a déjà un stripe_subscription_id, on force son utilisation
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
    const isAddEstablishmentFlow = flow === 'add-establishment';
    const isReduceQuotaFlow = flow === 'reduce-quota';
    // return_url : confettis + toast (UpgradeSuccessToast) + modale "Quoi de neuf" (showUpdates=true).
    const returnUrl = isUpgradeFlow
      ? `${baseUrl}/${locale}/dashboard?status=upgraded&showUpdates=true`
      : isAddEstablishmentFlow
        ? `${baseUrl}/${locale}/dashboard/establishments?status=upgraded&showUpdates=true`
        : isReduceQuotaFlow
          ? `${baseUrl}/${locale}/dashboard/establishments?return_flow=reduce`
          : `${baseUrl}/${locale}/dashboard/settings?status=upgraded`;

    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: returnUrl,
    };

    // CRITIQUE : on ne propose jamais de créer un nouvel abonnement si un existe déjà.
    // On force l'ID d'abonnement existant (profile.stripe_subscription_id ou premier actif/trialing).
    //
    // Ordre d'affichage des plans dans le Portail Stripe : l'API ne permet pas de le forcer en code.
    // Pour aligner l'ordre (Vision, Pulse, Zenith), aller dans le Dashboard Stripe > Settings > Billing >
    // Customer portal > section "Produits" et faire glisser les produits manuellement dans la liste.
    if (isUpgradeFlow || isAddEstablishmentFlow) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      });
      const activeOrTrialing = subscriptions.data.filter(
        (s) => s.status === 'active' || s.status === 'trialing'
      );
      // Priorité : abonnement déjà lié au profil, sinon premier actif/trialing
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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du portail' },
      { status: 500 }
    );
  }
}
