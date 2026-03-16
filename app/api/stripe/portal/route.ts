/**
 * POST /api/stripe/portal
 * Crée une session du Customer Portal (changer de plan / réduire quota).
 * Délègue au BillingDomainService. Email utilisateur validé avant tout appel Stripe.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { createPortalSession, findCustomerIdByEmail, findActiveSubscriptionForCustomer } from '@/lib/services/billing-domain';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email?.trim()) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', user.id)
      .single();
    const userLocale = (profile?.language as string) ?? new URL(request.url).searchParams.get('locale') ?? 'fr';
    const customerId = await findCustomerIdByEmail(email);

    if (!customerId) {
      return NextResponse.json(
        { error: 'Aucun compte de facturation trouvé' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'ouverture du portail' },
      { status: 500 }
    );
  }
}
