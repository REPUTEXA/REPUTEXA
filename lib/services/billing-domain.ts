/**
 * BillingDomainService — Source de vérité unique pour toute la logique métier Stripe/Billing.
 * Centralise : remises progressives (20/30/40/50), sessions Checkout/Portal, sync Supabase, emails.
 * Règle : une modification de règle de prix ou de flux ne se fait qu'ici.
 */

import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { stripeWithRetry } from '@/lib/stripe-client';
import { getStripePriceId, PLAN_BASE_PRICES_EUR, type PlanSlug } from '@/config/pricing';
import { getPlanSlugFromSubscription, getSubscriptionQuantity, getSubscriptionInterval } from '@/lib/stripe-subscription';
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

const TRIAL_DAYS = 14;
const PLAN_SLUG_TO_SUBSCRIPTION: Record<PlanSlug, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};
const PLAN_DISPLAY: Record<PlanSlug, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};
const DASHBOARD_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';

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
  locale: string;
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
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');

  const { email, userId, plan, annual, quantity, locale, skipTrial, isZenithTrial, successUrl, cancelUrl } = params;
  const effectivePlan = isZenithTrial ? 'zenith' : plan;
  const priceId = getStripePriceId(effectivePlan, annual);
  if (!priceId) throw new Error(annual ? 'Tarif annuel non configuré pour ce plan' : 'PriceId manquant');

  let customerId: string | null = null;
  await stripeWithRetry(async (s) => {
    const list = await s.customers.list({ email, limit: 1 });
    customerId = list.data[0]?.id ?? null;
  }, secretKey);

  if (!customerId) {
    const customer = await stripeWithRetry(
      (s) => s.customers.create({ email, metadata: { supabaseUserId: userId } }),
      secretKey
    );
    customerId = customer.id;
  }

  const stripeLocale = ['fr', 'en', 'it', 'es', 'de'].includes(locale) ? locale : 'fr';
  const session = await stripeWithRetry(
    (s) =>
      s.checkout.sessions.create({
        mode: 'subscription',
        payment_method_collection: 'always',
        customer: customerId!,
        locale: stripeLocale as 'fr' | 'en' | 'it' | 'es' | 'de',
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
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');

  const portalLocale = params.locale && ['fr', 'en', 'it', 'es', 'de'].includes(params.locale)
    ? (params.locale as 'fr' | 'en' | 'it' | 'es' | 'de')
    : undefined;
  const session = await stripeWithRetry(
    (s) =>
      s.billingPortal.sessions.create({
        customer: params.customerId,
        return_url: params.returnUrl,
        ...(portalLocale ? { locale: portalLocale } : {}),
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
};

/**
 * Met à jour la quantité d'un abonnement (expansion). Retourne l'URL de la facture à payer ou l'URL de succès.
 */
export async function expandSubscription(params: ExpandSubscriptionParams): Promise<{ url: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');

  const { subscriptionId, itemId, currentQuantity, addCount } = params;
  const newTotal = Math.min(15, currentQuantity + addCount);
  if (newTotal <= currentQuantity) throw new Error('La quantité cible doit être supérieure à l\'actuelle.');

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
};

/**
 * Expansion par email : trouve le client et l'abonnement actif, puis met à jour la quantité.
 * Retourne l'URL de la facture à payer ou une URL vide (succès immédiat si déjà payé).
 */
export async function expandSubscriptionByEmail(params: ExpandSubscriptionByEmailParams): Promise<{ url: string }> {
  const customerId = await findCustomerIdByEmail(params.email);
  if (!customerId) throw new Error('Aucun compte Stripe trouvé pour cet email');

  const sub = await findActiveSubscriptionForCustomer(customerId);
  if (!sub) throw new Error('Aucun abonnement actif.');

  const item = sub.items?.data?.[0];
  if (!item?.id) throw new Error('Abonnement invalide (item introuvable)');

  const currentQty = typeof item.quantity === 'number' && item.quantity >= 1 ? item.quantity : 1;
  return expandSubscription({
    subscriptionId: sub.id,
    itemId: item.id,
    currentQuantity: currentQty,
    addCount: params.addCount,
  });
}

export type CreateExpansionSessionParams = {
  email: string;
  addCount: number;
};

/**
 * Crée une session d'expansion (intention d'achat) : facture immédiate via Stripe (prorata + remise progressive).
 * À appeler depuis le bouton "Ajouter un nouvel emplacement". Rien n'est créé en base tant que invoice.paid n'a pas été reçu.
 */
export async function createExpansionSession(params: CreateExpansionSessionParams): Promise<{ url: string }> {
  return expandSubscriptionByEmail({ email: params.email, addCount: params.addCount });
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

  return {
    selected_plan: planSlug,
    subscription_plan: PLAN_SLUG_TO_SUBSCRIPTION[planSlug],
    subscription_status: status,
    subscription_quantity: quantity,
    subscription_period_end: periodEnd,
    trial_ends_at: trialEndsAt,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
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
};

export function sendWelcomePaidEmail(params: SendWelcomePaidParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const html = getWelcomePaidHtml({
    planName: params.planName,
    establishmentName: params.establishmentName,
    loginUrl: params.loginUrl,
    supportUrl: params.supportUrl,
  });
  return sendEmail({
    to: params.to,
    subject: 'Merci pour votre confiance ! Votre surveillance 24/7 est activée.',
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendWelcomePaid', err));
}

export type SendWelcomeTrialParams = {
  to: string;
  loginUrl: string;
  settingsUrl: string;
  supportUrl: string;
};

export function sendWelcomeTrialEmail(params: SendWelcomeTrialParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const html = getWelcomeZenithTrialHtml({
    loginUrl: params.loginUrl,
    settingsUrl: params.settingsUrl,
    supportUrl: params.supportUrl,
  });
  return sendEmail({
    to: params.to,
    subject: "🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
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
};

/**
 * Email de bienvenue essai Zénith (template premium sombre). Déclenché dès qu'un abonnement
 * en mode trialing est créé (webhook checkout.session.completed). Envoi via Resend.
 */
export function sendTrialWelcomeEmail(params: SendTrialWelcomeEmailParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const dashboardUrl = params.dashboardUrl ?? `${APP_URL}/fr/dashboard`;
  const html = getZenithTrialWelcomeEmailHtml({
    customerName: params.customerName,
    trialEndDate: params.trialEndDate,
    dashboardUrl,
    settingsUrl: params.settingsUrl,
  });
  return sendEmail({
    to: params.to,
    subject: "🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
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
  };
  const html = getReputexaOnboardingEmailHtml(data);
  const subject = params.isTrial
    ? `🚀 C'est parti ! Tes 14 jours d'accès ${params.planName} commencent.`
    : `✅ Paiement confirmé : Bienvenue chez Reputexa (${params.planName})`;
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
};

export function sendEstablishmentAddedEmail(params: SendEstablishmentAddedParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const html = getEstablishmentAddedEmailHtml({
    establishmentName: params.establishmentName,
    totalNextMonth: params.totalNextMonth,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: 'Nouvel établissement configuré — REPUTEXA',
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendEstablishmentAdded', err));
}

export type SendUpgradeConfirmationParams = {
  to: string;
  planName: string;
  establishmentName: string;
  dashboardUrl: string;
};

export function sendUpgradeConfirmationEmail(params: SendUpgradeConfirmationParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const html = getUpgradeConfirmationEmailHtml({
    planName: params.planName,
    establishmentName: params.establishmentName,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: 'Confirmation de mise à niveau — REPUTEXA',
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendUpgradeConfirmation', err));
}

export type SendDowngradeConfirmationParams = {
  to: string;
  quantity: number;
  dashboardUrl: string;
};

/** Envoyé après un downgrade (plan ou quantité) : données conservées, accès limités à {quantity} emplacement(s). */
export function sendDowngradeConfirmationEmail(params: SendDowngradeConfirmationParams): Promise<unknown> {
  if (!canSendEmail()) return Promise.resolve();
  const html = getDowngradeConfirmationEmailHtml({
    quantity: params.quantity,
    dashboardUrl: params.dashboardUrl,
  });
  return sendEmail({
    to: params.to,
    subject: 'Changement de forfait — vos données sont conservées',
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  }).catch((err) => console.error('[billing-domain] sendDowngradeConfirmation', err));
}

export type SendMonthlyInvoiceEmailParams = {
  to: string;
  monthYear: string;
  invoiceUrl: string;
};

/** Envoyé sur invoice.paid (billing_reason === 'subscription_cycle'). Log pour debug. */
export function sendMonthlyInvoiceEmail(params: SendMonthlyInvoiceEmailParams): Promise<unknown> {
  if (!canSendEmail()) {
    console.log('[billing-domain] sendMonthlyInvoiceEmail: Resend not configured, skip');
    return Promise.resolve();
  }
  const html = getMonthlyInvoiceEmailHtml({
    monthYear: params.monthYear,
    invoiceUrl: params.invoiceUrl,
  });
  const subject = `Votre facture Reputexa - ${params.monthYear}`;
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
};

export type SendPaymentActionRequiredEmailParams = {
  to: string;
  invoiceUrl: string;
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
  const html = getPlanSelectionConfirmationEmailHtml({
    planName: params.planName,
    planPrice: params.planPrice,
    trialEndDate: params.trialEndDate,
    locale: userLocale,
  });
  return sendEmail({
    to: params.to,
    subject: userLocale === 'en' ? 'Plan selection confirmed — REPUTEXA' : 'Confirmation de votre choix de plan — REPUTEXA',
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
  const html = getPaymentFailedEmailHtml({
    portalUrl: params.portalUrl,
    dashboardBillingUrl: params.dashboardBillingUrl,
  });
  const subject = 'Paiement échoué — Mettez à jour votre moyen de paiement';
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
  const html = getPaymentActionRequiredEmailHtml({ invoiceUrl: params.invoiceUrl });
  const subject = 'Action requise : Validez votre paiement';
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
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
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

export { getPlanSlugFromSubscription, getSubscriptionQuantity, getSubscriptionInterval, PLAN_DISPLAY, PLAN_SLUG_TO_SUBSCRIPTION, APP_URL };
