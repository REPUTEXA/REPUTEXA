import { NextResponse } from 'next/server';
import { apiBillingJsonError, apiJsonError } from '@/lib/api/api-error-response';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { resolveStripePaymentLocaleFromRequest } from '@/lib/api/stripe-locale-from-request';
import { getStripePriceId, type PlanSlug } from '@/config/pricing';
import {
  parseUserCurrencyFromCookieHeader,
  resolveBillingCurrencyForCheckout,
} from '@/lib/billing/resolve-billing-currency';
import {
  getPaymentMethodsForLocale,
  stripeCheckoutCurrencyForPaymentMethods,
  stripeCheckoutHostedLocale,
  stripeCustomerPreferredLocales,
  syncStripeCustomerPreferredLocales,
} from '@/lib/services/billing-domain';

const TRIAL_DAYS = 14;

type PlanType = 'starter' | 'manager' | 'dominator';

function isValidPlan(plan: string | null): plan is PlanType {
  return plan !== null && (plan === 'starter' || plan === 'manager' || plan === 'dominator');
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return apiJsonError(request, 'stripeSecretNotConfigured', 500);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return apiJsonError(request, 'unauthorized', 401);
    }

    const stripe = new Stripe(secretKey);
    const { searchParams } = new URL(request.url);
    const paymentLocale = resolveStripePaymentLocaleFromRequest(request, {
      queryLocale: searchParams.get('locale'),
    });
    const { data: profile } = await supabase
      .from('profiles')
      .select('language, billing_currency')
      .eq('id', user.id)
      .single();
    const customerEmailLocale = normalizeAppLocale((profile?.language as string) ?? paymentLocale);
    const appLocale = paymentLocale;
    const planType: PlanType = isValidPlan(searchParams.get('planType'))
      ? (searchParams.get('planType') as PlanType)
      : 'manager';

    const planSlugMap = { starter: 'vision', manager: 'pulse', dominator: 'zenith' } as const;
    const planSlug = planSlugMap[planType] as PlanSlug;
    const cookieCurrency = parseUserCurrencyFromCookieHeader(request.headers.get('cookie'));
    const billingCurrency = resolveBillingCurrencyForCheckout(
      appLocale,
      cookieCurrency,
      profile?.billing_currency as string | null | undefined,
    );
    const priceId = getStripePriceId(planSlug, false, billingCurrency);
    if (!priceId) {
      return apiBillingJsonError(request, 'planPriceEnvNotConfigured', 500, {
        envKey: `STRIPE_PRICE_ID_${planSlug.toUpperCase()} (${billingCurrency})`,
      });
    }
    const baseUrl = getSiteUrl();

    const existing = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId = existing.data[0]?.id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        preferred_locales: stripeCustomerPreferredLocales(customerEmailLocale),
        metadata: { supabaseUserId: user.id },
      });
      customerId = customer.id;
    } else {
      await syncStripeCustomerPreferredLocales(customerId, customerEmailLocale);
    }

    const paymentMethodTypes = getPaymentMethodsForLocale(appLocale);
    const checkoutCurrency = stripeCheckoutCurrencyForPaymentMethods(paymentMethodTypes);

    const successUrl = `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${appLocale}&plan=${planSlug}&status=trial_started`;
    const cancelUrl = `${baseUrl}/${appLocale}/dashboard`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      locale: stripeCheckoutHostedLocale(appLocale),
      payment_method_collection: 'always',
      payment_method_types: paymentMethodTypes,
      ...(checkoutCurrency ? { currency: checkoutCurrency } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { supabaseUserId: user.id, planSlug },
      },
      metadata: { planSlug },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/checkout]', error);
    return apiBillingJsonError(request, 'checkoutFailed', 500);
  }
}
