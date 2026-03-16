/**
 * POST /api/stripe/create-checkout
 * Crée une session Checkout Stripe. Délègue toute la logique au BillingDomainService.
 * L'email utilisateur est toujours validé avant toute création Stripe.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { createCheckoutQuerySchema, getQueryFromRequest } from '@/lib/validations/stripe';
import {
  createCheckoutSession,
  createPortalSession,
  findCustomerIdByEmail,
  findActiveSubscriptionForCustomer,
} from '@/lib/services/billing-domain';
import type { PlanSlug } from '@/config/pricing';

const LEGACY_PLAN_MAP: Record<string, PlanSlug> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
  'zenith-trial': 'zenith',
  starter: 'vision',
  manager: 'pulse',
  dominator: 'zenith',
};

export async function POST(request: Request) {
  try {
    const parsed = createCheckoutQuerySchema.safeParse(getQueryFromRequest(request));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Paramètres invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { locale, planSlug: rawPlanSlug, skipTrial, annual, quantity: rawQty } = parsed.data;
    const planType = new URL(request.url).searchParams.get('planType') ?? 'manager';
    const planSlug = (rawPlanSlug ?? (planType === 'dominator' ? 'zenith' : planType === 'manager' ? 'pulse' : 'vision')) as string;
    const quantity = typeof rawQty === 'number' ? rawQty : Math.min(15, Math.max(1, parseInt(String(rawQty ?? '1'), 10) || 1));
    const isZenithTrial = planSlug === 'zenith-trial';
    const effectivePlanSlug = isZenithTrial ? 'zenith' : (LEGACY_PLAN_MAP[planSlug] ?? 'pulse');
    const baseUrl = getSiteUrl().replace(/\/+$/, '');

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
    const userLocale = (profile?.language as string) ?? locale ?? 'fr';

    // Politique d'abonnement unique : si déjà abonné, rediriger vers le portail
    const customerId = await findCustomerIdByEmail(email);
    if (customerId) {
      const existingSub = await findActiveSubscriptionForCustomer(customerId);
      if (existingSub) {
        const { url } = await createPortalSession({
          customerId,
          returnUrl: `${baseUrl}/${userLocale}/dashboard?status=upgraded`,
          subscriptionId: existingSub.id,
          locale: userLocale,
        });
        return NextResponse.json({ url, redirectToPortal: true });
      }
    }

    // Redirection post-paiement : sync-profile sync le profil puis redirige vers /dashboard?status=success (évite de retomber sur la page plan).
    const successUrl = `${baseUrl}/api/stripe/sync-profile?session_id={CHECKOUT_SESSION_ID}&locale=${userLocale}`;
    const cancelUrl = `${baseUrl}/${userLocale}/pricing?plan=${effectivePlanSlug}&annual=${annual ? '1' : '0'}&status=cancelled`;

    const { url } = await createCheckoutSession({
      userId: user.id,
      email,
      plan: effectivePlanSlug,
      annual: annual ?? false,
      quantity,
      locale: userLocale,
      skipTrial: skipTrial ?? false,
      isZenithTrial,
      successUrl,
      cancelUrl,
    });

    if (!url) {
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[stripe/create-checkout]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
