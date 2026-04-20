/**
 * BillingDomainService — Source de vérité unique pour toute la logique métier Stripe/Billing.
 * Centralise : remises progressives (20/30/40/50), sessions Checkout/Portal, sync Supabase, emails.
 * Règle : une modification de règle de prix ou de flux ne se fait qu'ici.
 */

import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { stripeWithRetry } from '@/lib/stripe-client';
import {
  getStripePriceId,
  localeToBillingCurrency,
  PLAN_BASE_PRICES_EUR,
  type BillingCurrency,
  type PlanSlug,
} from '@/config/pricing';
import {
  billingCurrencyFromSubscription,
  getPlanSlugFromSubscription,
  getSubscriptionQuantity,
  getSubscriptionInterval,
} from '@/lib/stripe-subscription';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import {
  getWelcomePaidHtml,
  getWelcomeZenithTrialHtml,
  getZenithTrialWelcomeEmailHtml,
  getReputexaOnboardingEmailHtml,
  getEstablishmentAddedEmailHtml,
  getUpgradeConfirmationEmailHtml,
  getDowngradeConfirmationEmailHtml,
  getMonthlyInvoiceEmailHtml,
  getPaymentFailedEmailHtml,
  getPaymentActionRequiredEmailHtml,
  getPlanSelectionConfirmationEmailHtml,
} from '@/lib/emails/templates';
import type { ReputexaOnboardingEmailData } from '@/lib/emails/templates';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { BillingUserFacingError } from '@/lib/services/billing-errors';

const TRIAL_DAYS = 14;

/** Locales prises en charge par Stripe Checkout / Customer Portal (UI hébergée). */
const STRIPE_HOSTED_UI_LOCALES = new Set<string>([
  'auto',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'en-GB',
  'es',
  'es-419',
  'et',
  'fi',
  'fil',
  'fr',
  'fr-CA',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'ms',
  'mt',
  'nb',
  'nl',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'th',
  'tr',
  'vi',
  'zh',
  'zh-HK',
  'zh-TW',
]);

/**
 * Moyens de paiement Checkout selon la locale client (hyper-localisation).
 * `nl` : iDEAL ; `be` : Bancontact ; `fr`/`de`/`it`/`es`/`pt` : SEPA Debit ; sinon carte seule.
 */
export function getPaymentMethodsForLocale(locale: string): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  const code = (locale ?? '').toLowerCase().trim();
  if (code === 'nl') return ['card', 'ideal'];
  if (code === 'be') return ['card', 'bancontact'];
  if (code === 'fr' || code === 'de' || code === 'it' || code === 'es' || code === 'pt') {
    return ['card', 'sepa_debit'];
  }
  return ['card'];
}

/** iDEAL / Bancontact exigent l’EUR côté session Checkout. */
export function stripeCheckoutCurrencyForPaymentMethods(
  paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[]
): 'eur' | undefined {
  if (paymentMethodTypes.includes('ideal') || paymentMethodTypes.includes('bancontact')) return 'eur';
  return undefined;
}

/** Locale UI Stripe Checkout : `en` → US English ; `en-gb` → UK English ; sinon code app si supporté. */
export function stripeCheckoutHostedLocale(
  appLocale: string | null | undefined
): Stripe.Checkout.SessionCreateParams.Locale {
  const code = (appLocale ?? '').toLowerCase().trim();
  if (code === 'en') return 'en';
  if (code === 'en-gb') return 'en-GB';
  if (STRIPE_HOSTED_UI_LOCALES.has(code)) return code as Stripe.Checkout.SessionCreateParams.Locale;
  return 'en';
}

/** Même logique pour le Customer Portal. */
export function stripeBillingPortalHostedLocale(
  appLocale: string | null | undefined
): Stripe.BillingPortal.SessionCreateParams.Locale {
  const code = (appLocale ?? '').toLowerCase().trim();
  if (code === 'en') return 'en';
  if (code === 'en-gb') return 'en-GB';
  if (STRIPE_HOSTED_UI_LOCALES.has(code)) return code as Stripe.BillingPortal.SessionCreateParams.Locale;
  return 'en';
}

/**
 * Tags pour `Customer.preferred_locales` (e-mails automatiques Stripe).
 * Même repli que l’UI hébergée : langues non supportées → `en`.
 */
export function stripeCustomerPreferredLocales(appLocale: string | null | undefined): string[] {
  return [stripeCheckoutHostedLocale(appLocale)];
}

/**
 * Met à jour la langue préférée du client Stripe (e-mails traduits).
 */
export async function syncStripeCustomerPreferredLocales(
  customerId: string,
  appLocale: string | null | undefined
): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return;
  await stripeWithRetry(
    (s) =>
      s.customers.update(customerId, {
        preferred_locales: stripeCustomerPreferredLocales(appLocale),
      }),
    secretKey
  );
}

const PLAN_SLUG_TO_SUBSCRIPTION: Record<PlanSlug, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};
const DASHBOARD_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';

/** Libellé plan pour e-mails / webhooks (locale profil ou requête). */
export function getLocalizedPlanDisplayName(plan: PlanSlug, locale?: string | null): string {
  const loc = normalizeAppLocale(locale ?? undefined);
  const t = createServerTranslator('Billing', loc);
  if (plan === 'vision') return t('plans.vision');
  if (plan === 'pulse') return t('plans.pulse');
  return t('plans.zenith');
}

/** Webhook / logs : slug éventuellement vide ou inconnu → libellé traduit ou repli « Premium ». */
export function getLocalizedPlanDisplayNameLoose(planSlug: string | null | undefined, locale?: string | null): string {
  const s = planSlug ?? '';
  if (s === 'vision' || s === 'pulse' || s === 'zenith') {
    return getLocalizedPlanDisplayName(s, locale);
  }
  const t = createServerTranslator('Billing', normalizeAppLocale(locale ?? undefined));
  return t('errors.premiumFallbackPlan');
}

/**
 * Prix de base mensuel (EUR) formaté selon la locale BCP 47 du site + mention « / mois » localisée.
 */
export function formatBillingMonthlyPriceEur(amountWhole: number, locale?: string | null): string {
  const loc = normalizeAppLocale(locale ?? undefined);
  const intlTag = siteLocaleToIntlDateTag(loc);
  const price = new Intl.NumberFormat(intlTag, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amountWhole);
  const t = createServerTranslator('Billing', loc);
  return t('pricePerMonthFormatted', { price });
}

// ---------------------------------------------------------------------------
// 1) Remises progressives (alignées Stripe Graduated Tiers)
// ---------------------------------------------------------------------------

const DISCOUNT_BY_INDEX: Record<number, number> = {
  0: 0,
  1: 20,
  2: 30,
  3: 40,
};
const MAX_DISCOUNT = 50;

function getDiscountForIndex(index: number): number {
  if (index < 4) return DISCOUNT_BY_INDEX[index] ?? 0;
  return MAX_DISCOUNT;
}

/**
 * Prix unitaire après remise pour l'établissement à l'index donné (0 = 0%, 1 = -20%, 2 = -30%, 3 = -40%, 4+ = -50%).
 */
export function getUnitPriceAfterDiscount(basePrice: number, index: number): number {
  const discount = getDiscountForIndex(index);
  return Math.round(basePrice * (1 - discount / 100));
}

/**
 * Prix total pour un plan et un nombre d'établissements (mensuel ou annuel avec -20%).
 */
export function getTotalPrice(plan: PlanSlug, count: number, annual: boolean): number {
  if (count <= 0) return 0;
  const basePrice = PLAN_BASE_PRICES_EUR[plan];
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getUnitPriceAfterDiscount(basePrice, i);
  }
  return annual ? Math.round(total * 12 * 0.8) : total;
}

// ---------------------------------------------------------------------------
// 2) Sessions Stripe (tous les appels passent par stripeWithRetry)
// ---------------------------------------------------------------------------

export type CreateCheckoutSessionParams = {
  userId: string;
  email: string;
  plan: PlanSlug;
  annual: boolean;
  quantity: number;
  /** Locale UI Checkout / devise / moyens de paiement (URL du site). */
  locale: string;
  /** Devise catalogue (ex. cookie `user-currency`). Si absent, dérivée de `locale`. */
  billingCurrency?: BillingCurrency | null;
  /**
   * Locale pour `preferred_locales` (e-mails Stripe). Si absent, dérivée de `locale`.
   * Peut refléter la langue du profil utilisateur.
   */
  customerPreferredLocale?: string | null;
  skipTrial: boolean;
  isZenithTrial?: boolean;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Crée une session Checkout Stripe. L'email doit être validé côté appelant.
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ url: string | null }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new BillingUserFacingError('stripeNotConfigured');

  const {
    email,
    userId,
    plan,
    annual,
    quantity,
    locale,
    customerPreferredLocale,
    skipTrial,
    isZenithTrial,
    successUrl,
    cancelUrl,
    billingCurrency: billingCurrencyOverride,
  } = params;
  const loc = normalizeAppLocale(locale);
  const preferredEmailLocale = normalizeAppLocale(customerPreferredLocale ?? locale);
  const effectivePlan = isZenithTrial ? 'zenith' : plan;
  const billingCurrency = billingCurrencyOverride ?? localeToBillingCurrency(loc);
  const priceId = getStripePriceId(effectivePlan, annual, billingCurrency);
  if (!priceId) {
    throw new BillingUserFacingError(annual ? 'annualPriceNotConfigured' : 'monthlyPriceNotConfigured');
  }

  let customerId: string | null = null;
  await stripeWithRetry(async (s) => {
    const list = await s.customers.list({ email, limit: 1 });
    customerId = list.data[0]?.id ?? null;
  }, secretKey);

  if (!customerId) {
    const customer = await stripeWithRetry(
      (s) =>
        s.customers.create({
          email,
          preferred_locales: stripeCustomerPreferredLocales(preferredEmailLocale),
          metadata: { supabaseUserId: userId },
        }),
      secretKey
    );
    customerId = customer.id;
  } else {
    await syncStripeCustomerPreferredLocales(customerId, preferredEmailLocale);
  }

  const paymentMethodTypes = getPaymentMethodsForLocale(loc);
  const checkoutCurrency = stripeCheckoutCurrencyForPaymentMethods(paymentMethodTypes);
  console.log(
    '[stripe]',
    'checkout',
    'locale=' + loc,
    'payment_method_types=' + paymentMethodTypes.join(',')
  );
  const session = await stripeWithRetry(
    (s) =>
      s.checkout.sessions.create({
        mode: 'subscription',
        payment_method_collection: 'always',
        customer: customerId!,
        locale: stripeCheckoutHostedLocale(loc),
        payment_method_types: paymentMethodTypes,
        ...(checkoutCurrency ? { currency: checkoutCurrency } : {}),
        line_items: [
          {
            price: priceId,
            quantity,
            adjustable_quantity: { enabled: true, minimum: 1, maximum: 15 },
          },
        ],
        subscription_data: {
          metadata: { planSlug: effectivePlan, quantity: String(quantity) },
          ...(isZenithTrial || !skipTrial ? { trial_period_days: TRIAL_DAYS } : {}),
        },
        metadata: { planSlug: effectivePlan, quantity: String(quantity) },
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
      }),
    secretKey
  );

  return { url: session.url };
}

export type CreatePortalSessionParams = {
  customerId: string;
  returnUrl: string;
  subscriptionId?: string;
  locale?: string;
};

/**
 * Crée une session du Customer Portal (changer de plan / gérer l'abonnement).
 * Prorata downgrade : configurer dans le Dashboard Stripe (Billing → Customer portal → Subscription updates)
 * le comportement "Create credits for unused time" pour que les passages à un plan moins cher génèrent une note de crédit.
 */
export async function createPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new BillingUserFacingError('stripeNotConfigured');

  const portalLocale = stripeBillingPortalHostedLocale(normalizeAppLocale(params.locale));
  const session = await stripeWithRetry(
    (s) =>
      s.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
        locale: portalLocale,
        ...(params.subscriptionId
          ? {
              flow_data: {
                type: 'subscription_update' as const,
                subscription_update: { subscription: params.subscriptionId },
              },
            }
          : {}),
      }),
    secretKey
  );

  return { url: session.url! };
}

export type ExpandSubscriptionParams = {
  subscriptionId: string;
  itemId: string;
  currentQuantity: number;
  addCount: number;
  /** Pour messages d’erreur localisés */
  locale: string;
};

/**
 * Met à jour la quantité d'un abonnement (expansion). Retourne l'URL de la facture à payer ou l'URL de succès.
 */
export async function expandSubscription(params: ExpandSubscriptionParams): Promise<{ url: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new BillingUserFacingError('stripeNotConfigured');

  const { subscriptionId, itemId, currentQuantity, addCount, locale: _locale } = params;
  const newTotal = Math.min(15, currentQuantity + addCount);
  if (newTotal <= currentQuantity) {
    throw new BillingUserFacingError('quantityTargetMustExceedCurrent');
  }

  const updated = await stripeWithRetry(
    (s) =>
      s.subscriptions.update(subscriptionId, {
        items: [{ id: itemId, quantity: newTotal }],
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
      }),
    secretKey
  );

  const latestInvoiceId =
    typeof updated.latest_invoice === 'string' ? updated.latest_invoice : updated.latest_invoice?.id;
  if (!latestInvoiceId) return { url: '' };

  const invoice = await stripeWithRetry((s) => s.invoices.retrieve(latestInvoiceId), secretKey);
  if (invoice.status === 'paid') return { url: '' };
  if (invoice.hosted_invoice_url) return { url: invoice.hosted_invoice_url };
  return { url: '' };
}

export type ExpandSubscriptionByEmailParams = {
  email: string;
  addCount: number;
  /** Locale UI (cookie / profil) pour erreurs utilisateur */
  locale: string;
};

/**
 * Expansion par email : trouve le client et l'abonnement actif, puis met à jour la quantité.
 * Retourne l'URL de la facture à payer ou une URL vide (succès immédiat si déjà payé).
 */
export async function expandSubscriptionByEmail(params: ExpandSubscriptionByEmailParams): Promise<{ url: string }> {
  const customerId = await findCustomerIdByEmail(params.email);
  if (!customerId) throw new BillingUserFacingError('stripeCustomerNotFound');

  const sub = await findActiveSubscriptionForCustomer(customerId);
  if (!sub) throw new BillingUserFacingError('noActiveSubscription');

  const item = sub.items?.data?.[0];
  if (!item?.id) throw new BillingUserFacingError('invalidSubscriptionItem');

  const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
  return expandSubscription({
    subscriptionId: sub.id,
    itemId: item.id,
    currentQuantity: currentQty,
    addCount: params.addCount,
    locale: params.locale,
  });
}

export type CreateExpansionSessionParams = {
  email: string;
  addCount: number;
  locale: string;
};

/**
 * Crée une session d'expansion (intention d'achat) : facture immédiate via Stripe (prorata + remise progressive).
 * À appeler depuis le bouton "Ajouter un nouvel emplacement". Rien n'est créé en base tant que invoice.paid n'a pas été reçu.
 */
export async function createExpansionSession(params: CreateExpansionSessionParams): Promise<{ url: string }> {
  return expandSubscriptionByEmail({
    email: params.email,
    addCount: params.addCount,
    locale: params.locale,
  });
}

export type ExpandSubscriptionToTargetQuantityParams = {
  email: string;
  targetQuantity: number;
  locale: string;
};

/**
 * Passe la quantité d’abonnement à `targetQuantity` (borne 1–15), à partir de l’état Stripe courant.
 */
export async function expandSubscriptionToTargetQuantity(
  params: ExpandSubscriptionToTargetQuantityParams
): Promise<{ url: string }> {
  const q = Math.min(15, Math.max(1, params.targetQuantity));
  const customerId = await findCustomerIdByEmail(params.email);
  if (!customerId) throw new BillingUserFacingError('stripeCustomerNotFound');

  const sub = await findActiveSubscriptionForCustomer(customerId);
  if (!sub) throw new BillingUserFacingError('noActiveSubscription');

  const item = sub.items?.data?.[0];
  if (!item?.id) throw new BillingUserFacingError('invalidSubscriptionItem');

  const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
  const addCount = q - currentQty;
  if (addCount <= 0) throw new BillingUserFacingError('quantityTargetMustExceedCurrent');

  return expandSubscription({
    subscriptionId: sub.id,
    itemId: item.id,
    currentQuantity: currentQty,
    addCount,
    locale: params.locale,
  });
}

// ---------------------------------------------------------------------------
// 3) Synchronisation Stripe → Supabase (profil)
// ---------------------------------------------------------------------------

export type ProfileSyncPayload = {
  selected_plan: PlanSlug;
  subscription_plan: string;
  subscription_status: string;
  subscription_quantity: number;
  subscription_period_end: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  /** Devise des lignes Stripe (verrouillage facturation côté app). */
  billing_currency: string;
};

/**
 * Construit le payload de mise à jour profil à partir d'un abonnement Stripe.
 */
export function buildProfileSyncFromSubscription(subscription: Stripe.Subscription): ProfileSyncPayload & { customerEmail: string | null } {
  const planSlug = (getPlanSlugFromSubscription(subscription) ?? 'vision') as PlanSlug;
  const quantity = getSubscriptionQuantity(subscription);
  const status = subscription.status === 'trialing' ? 'trialing' : subscription.status === 'active' ? 'active' : 'expired';
  const subPeriodEnd = (subscription as { current_period_end?: number }).current_period_end;
  const periodEnd = subPeriodEnd
    ? new Date(subPeriodEnd * 1000).toISOString()
    : null;
  const trialEndsAt = status === 'trialing' && subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as Stripe.Customer)?.id ?? null;
  const cust = subscription.customer as Stripe.Customer | undefined;
  const customerEmail =
    typeof subscription.customer === 'object' && cust?.email
      ? cust.email
      : null;

  const billingCurrency = billingCurrencyFromSubscription(subscription);

  return {
    selected_plan: planSlug,
    subscription_plan: PLAN_SLUG_TO_SUBSCRIPTION[planSlug],
    subscription_status: status,
    subscription_quantity: quantity,
    subscription_period_end: periodEnd,
    trial_ends_at: trialEndsAt,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    billing_currency: billingCurrency,
    customerEmail,
  };
}

/**
 * Met à jour le profil Supabase (par email) avec les données dérivées de l'abonnement Stripe.
 * @param customerEmailOverride — Si fourni, utilisé pour la recherche du profil (ex. email venant de la session Checkout).
 */
export async function syncProfileFromSubscription(
  subscription: Stripe.Subscription,
  customerEmailOverride?: string | null
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const payload = buildProfileSyncFromSubscription(subscription);
  const email = customerEmailOverride?.trim() || payload.customerEmail?.trim() || null;
  if (!email) return;

  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1);

  if (!profiles?.length) return;

  const { customerEmail: _customerEmail, ...update } = payload;
  await admin.from('profiles').update(update).eq('id', profiles[0].id);
}

// ---------------------------------------------------------------------------
// 4) Emails transactionnels (déclenchés par les webhooks)
// ---------------------------------------------------------------------------

export type SendWelcomePaidParams = {
  to: string;
  planName: string;
  establishmentName: string;
  loginUrl: string;
  supportUrl: string;
  /** Langue des sujets d’e-mail (profil / préférence). */
  locale?: string;
};

export function sendWelcomePaidEmail(params: SendWelcomePaidParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getWelcomePaidHtml({
    planName: params.planName,
    establishmentName: params.establishmentName,
    loginUrl: params.loginUrl,
    supportUrl: params.supportUrl,
    locale: params.locale,
  });
  return sendEmail({
    to: params.to,
    subject: t('welcomePaid'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendWelcomePaid', err));
}

export type SendWelcomeTrialParams = {
  to: string;
  loginUrl: string;
  settingsUrl: string;
  supportUrl: string;
  locale?: string;
};

export function sendWelcomeTrialEmail(params: SendWelcomeTrialParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getWelcomeZenithTrialHtml({
    loginUrl: params.loginUrl,
    settingsUrl: params.settingsUrl,
    supportUrl: params.supportUrl,
    locale: params.locale,
  });
  return sendEmail({
    to: params.to,
    subject: t('welcomeTrialZenith'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendWelcomeTrial', err));
}

export type SendTrialWelcomeEmailParams = {
  to: string;
  customerName: string;
  trialEndDate: string;
  dashboardUrl?: string;
  settingsUrl?: string;
  locale?: string;
};

/**
 * Email de bienvenue essai Zénith (template premium sombre). Déclenché dès qu'un abonnement
 * en mode trialing est créé (webhook checkout.session.completed). Envoi via Resend.
 */
export function sendTrialWelcomeEmail(params: SendTrialWelcomeEmailParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const loc = normalizeAppLocale(params.locale);
  const dashboardUrl = params.dashboardUrl ?? `${APP_URL}/${loc}/dashboard`;
  const t = createServerTranslator('BillingEmails', loc);
  const html = getZenithTrialWelcomeEmailHtml({
    customerName: params.customerName,
    trialEndDate: params.trialEndDate,
    dashboardUrl,
    settingsUrl: params.settingsUrl,
  });
  return sendEmail({
    to: params.to,
    subject: t('welcomeTrialZenith'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendTrialWelcomeEmail', err));
}

export type SendReputexaOnboardingEmailParams = {
  to: string;
  customerName: string;
  planName: string;
  planSlug: 'vision' | 'pulse' | 'zenith';
  trialEndDate: string | null;
  invoiceUrl: string | null;
  interval: 'month' | 'year';
  isTrial: boolean;
  locale?: string;
};

/**
 * Email d'onboarding unique — déclenché exclusivement sur webhook invoice.paid
 * (inclut les factures à 0€ des essais). Envoi via Resend en <10s après l'event.
 */
export function sendReputexaOnboardingEmail(params: SendReputexaOnboardingEmailParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.warn('[billing-domain] sendReputexaOnboardingEmail: Resend not configured (RESEND_API_KEY?), skip');
    return Promise.resolve();
  }
  const userLocale = (params.locale && ['fr', 'en', 'it', 'es', 'de'].includes(params.locale)) ? params.locale : 'fr';
  const tSub = createServerTranslator('BillingEmails', userLocale);
  const dashboardUrl = `${APP_URL}/${userLocale}/dashboard`;
  const settingsUrl = `${APP_URL}/${userLocale}/dashboard/settings`;
  const data: ReputexaOnboardingEmailData = {
    customerName: params.customerName,
    planName: params.planName,
    planSlug: params.planSlug,
    trialEndDate: params.trialEndDate,
    invoiceUrl: params.invoiceUrl,
    interval: params.interval,
    isTrial: params.isTrial,
    dashboardUrl,
    settingsUrl,
    unsubscribeUrl: settingsUrl,
    locale: userLocale,
  };
  const html = getReputexaOnboardingEmailHtml(data);
  const subject = params.isTrial
    ? tSub('onboardingTrial', { planName: params.planName })
    : tSub('onboardingPaid', { planName: params.planName });
  return sendEmail({
    to: params.to,
    subject,
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendReputexaOnboardingEmail', err));
}

export type SendEstablishmentAddedParams = {
  to: string;
  establishmentName: string;
  totalNextMonth: number;
  dashboardUrl: string;
  locale?: string;
};

export function sendEstablishmentAddedEmail(params: SendEstablishmentAddedParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getEstablishmentAddedEmailHtml({
    establishmentName: params.establishmentName,
    totalNextMonth: params.totalNextMonth,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: t('establishmentAdded'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendEstablishmentAdded', err));
}

export type SendUpgradeConfirmationParams = {
  to: string;
  planName: string;
  establishmentName: string;
  dashboardUrl: string;
  locale?: string;
};

export function sendUpgradeConfirmationEmail(params: SendUpgradeConfirmationParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getUpgradeConfirmationEmailHtml({
    planName: params.planName,
    establishmentName: params.establishmentName,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: t('upgradeConfirmation'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendUpgradeConfirmation', err));
}

export type SendDowngradeConfirmationParams = {
  to: string;
  quantity: number;
  dashboardUrl: string;
  locale?: string;
};

/** Envoyé après un downgrade (plan ou quantité) : données conservées, accès limités à {quantity} emplacement(s). */
export function sendDowngradeConfirmationEmail(params: SendDowngradeConfirmationParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getDowngradeConfirmationEmailHtml({
    quantity: params.quantity,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: t('downgradeConfirmation'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendDowngradeConfirmation', err));
}

export type SendMonthlyInvoiceEmailParams = {
  to: string;
  monthYear: string;
  invoiceUrl: string;
  locale?: string;
};

/** Envoyé sur invoice.paid (billing_reason === 'subscription_cycle'). Log pour debug. */
export function sendMonthlyInvoiceEmail(params: SendMonthlyInvoiceEmailParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.log('[billing-domain] sendMonthlyInvoiceEmail: Resend not configured, skip');
    return Promise.resolve();
  }
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getMonthlyInvoiceEmailHtml({
    monthYear: params.monthYear,
    invoiceUrl: params.invoiceUrl,
  });
  const subject = t('monthlyInvoice', { monthYear: params.monthYear });
  console.log('[billing-domain] sendMonthlyInvoiceEmail: sending to', params.to, 'subject', subject);
  return sendEmail({
    to: params.to,
    subject,
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  })
    .then((r) => {
      if (r.success) console.log('[billing-domain] sendMonthlyInvoiceEmail: sent ok');
      return r;
    })
    .catch((err) => {
      console.error('[billing-domain] sendMonthlyInvoiceEmail', err);
      throw err;
    });
}

export type SendPaymentFailedEmailParams = {
  to: string;
  portalUrl: string;
  dashboardBillingUrl: string;
  locale?: string;
};

export type SendPaymentActionRequiredEmailParams = {
  to: string;
  invoiceUrl: string;
  locale?: string;
};

export type SendPlanSelectionConfirmationParams = {
  to: string;
  planName: string;
  planPrice: string;
  trialEndDate: string;
  locale?: string;
};

/** Envoyé après enregistrement du choix de plan futur (PULSE/VISION) pendant l'essai ZÉNITH. */
export function sendPlanSelectionConfirmationEmail(params: SendPlanSelectionConfirmationParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.warn('[billing-domain] sendPlanSelectionConfirmationEmail: Resend not configured, skip');
    return Promise.resolve();
  }
  const userLocale = (params.locale && ['fr', 'en', 'it', 'es', 'de'].includes(params.locale)) ? params.locale : 'fr';
  const t = createServerTranslator('BillingEmails', userLocale);
  const html = getPlanSelectionConfirmationEmailHtml({
    planName: params.planName,
    planPrice: params.planPrice,
    trialEndDate: params.trialEndDate,
    locale: userLocale,
  });
  return sendEmail({
    to: params.to,
    subject: t('planSelectionConfirmed'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendPlanSelectionConfirmationEmail', err));
}

/** Envoyé sur invoice.payment_failed. Log pour debug. */
export function sendPaymentFailedEmail(params: SendPaymentFailedEmailParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.log('[billing-domain] sendPaymentFailedEmail: Resend not configured, skip');
    return Promise.resolve();
  }
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getPaymentFailedEmailHtml({
    portalUrl: params.portalUrl,
    dashboardBillingUrl: params.dashboardBillingUrl,
  });
  const subject = t('paymentFailed');
  console.log('[billing-domain] sendPaymentFailedEmail: sending to', params.to);
  return sendEmail({
    to: params.to,
    subject,
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  })
    .then((r) => {
      if (r.success) console.log('[billing-domain] sendPaymentFailedEmail: sent ok');
      return r;
    })
    .catch((err) => {
      console.error('[billing-domain] sendPaymentFailedEmail', err);
      throw err;
    });
}

/** Envoyé sur invoice.payment_action_required (3D Secure / auth supplémentaire). */
export function sendPaymentActionRequiredEmail(params: SendPaymentActionRequiredEmailParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.log('[billing-domain] sendPaymentActionRequiredEmail: Resend not configured, skip');
    return Promise.resolve();
  }
  const t = createServerTranslator('BillingEmails', params.locale);
  const html = getPaymentActionRequiredEmailHtml({ invoiceUrl: params.invoiceUrl });
  const subject = t('paymentActionRequired');
  console.log('[billing-domain] sendPaymentActionRequiredEmail: sending to', params.to);
  return sendEmail({
    to: params.to,
    subject,
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  })
    .then((r) => {
      if (r.success) console.log('[billing-domain] sendPaymentActionRequiredEmail: sent ok');
      return r;
    })
    .catch((err) => {
      console.error('[billing-domain] sendPaymentActionRequiredEmail', err);
      throw err;
    });
}

// ---------------------------------------------------------------------------
// 5) Revalidation Next.js (zéro Cmd+R côté utilisateur)
// ---------------------------------------------------------------------------

export function revalidateDashboardPaths(): void {
  try {
    for (const locale of DASHBOARD_LOCALES) {
      revalidatePath(`/${locale}/dashboard`, 'layout');
      revalidatePath(`/${locale}/dashboard/establishments`, 'layout');
    }
    revalidatePath('/dashboard', 'layout');
  } catch (e) {
    console.error('[billing-domain] revalidatePath failed', e);
  }
}

/** Purge tout le cache de l'app (layout racine). À utiliser après changement de plan côté webhook. */
export function revalidateFullApp(): void {
  try {
    revalidatePath('/', 'layout');
  } catch (e) {
    console.error('[billing-domain] revalidateFullApp failed', e);
  }
}

// ---------------------------------------------------------------------------
// 6) Helpers exposés pour les routes (lecture Stripe)
// ---------------------------------------------------------------------------

/**
 * Retourne l'abonnement "canonique" du client (actif ou en essai).
 * Inclut trialing pour permettre la transition trial Zénith → PULSE/VISION sans erreur
 * (subscription_update Stripe gère le changement de plan pendant l'essai).
 */
export async function findActiveSubscriptionForCustomer(customerId: string): Promise<Stripe.Subscription | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const subs = await stripeWithRetry(
    (s) => s.subscriptions.list({ customer: customerId, status: 'all', limit: 10 }),
    secretKey
  );
  return subs.data.find((s) => s.status === 'active' || s.status === 'trialing') ?? null;
}

export async function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new BillingUserFacingError('stripeNotConfigured');
  return stripeWithRetry((s) => s.subscriptions.retrieve(subscriptionId), secretKey);
}

/**
 * Quantité à écrire en DB pour éviter les "slots fantômes" : n'augmente pas tant que la dernière facture n'est pas payée.
 */
export async function getQuantitySafeToSync(
  subscription: Stripe.Subscription,
  dbQuantity: number | null
): Promise<number> {
  const quantity = getSubscriptionQuantity(subscription);
  if (dbQuantity === null || quantity <= dbQuantity) return quantity;
  const latestInvoiceId =
    typeof subscription.latest_invoice === 'string'
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;
  if (!latestInvoiceId) return dbQuantity ?? 1;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return dbQuantity ?? 1;
  try {
    const inv = await stripeWithRetry((s) => s.invoices.retrieve(latestInvoiceId), secretKey);
    return inv.status === 'paid' ? quantity : (dbQuantity ?? 1);
  } catch {
    return dbQuantity ?? 1;
  }
}

export async function findCustomerIdByEmail(email: string): Promise<string | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const list = await stripeWithRetry((s) => s.customers.list({ email, limit: 1 }), secretKey);
  return list.data[0]?.id ?? null;
}

export { getPlanSlugFromSubscription, getSubscriptionQuantity, getSubscriptionInterval, PLAN_SLUG_TO_SUBSCRIPTION, APP_URL };
