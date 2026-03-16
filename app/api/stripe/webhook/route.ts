/**
 * Webhook Stripe — Délégation au BillingDomainService.
 * Règle : tout appel Stripe passe par stripeWithRetry (via le service ou stripe-client).
 * invoice.paid = déclencheur unique : sync profil (pending→active), email "Nouvel établissement configuré", revalidatePath.
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripeWithRetry } from '@/lib/stripe-client';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  syncProfileFromSubscription,
  retrieveSubscription,
  revalidateDashboardPaths,
  revalidateFullApp,
  sendEstablishmentAddedEmail,
  sendReputexaOnboardingEmail,
  sendMonthlyInvoiceEmail,
  sendPaymentFailedEmail,
  sendPaymentActionRequiredEmail,
  sendUpgradeConfirmationEmail,
  sendDowngradeConfirmationEmail,
  getPlanSlugFromSubscription,
  getSubscriptionQuantity,
  getSubscriptionInterval,
  getTotalPrice,
  PLAN_DISPLAY,
  PLAN_SLUG_TO_SUBSCRIPTION,
  APP_URL,
} from '@/lib/services/billing-domain';
import type { PlanSlug } from '@/config/pricing';
import { PRICE_ID_ENV_KEYS } from '@/config/pricing';

/**
 * Correspondance slug plan → price_id Stripe (mensuel / annuel).
 * Utilisé pour l'update de souscription au passage trialing→active (selected_plan en base).
 */
function getPlanSlugToStripePriceIds(): Record<PlanSlug, { monthly: string | null; annual: string | null }> {
  return {
    vision: {
      monthly: process.env[PRICE_ID_ENV_KEYS.vision.monthly] ?? null,
      annual: process.env[PRICE_ID_ENV_KEYS.vision.annual] ?? null,
    },
    pulse: {
      monthly: process.env[PRICE_ID_ENV_KEYS.pulse.monthly] ?? null,
      annual: process.env[PRICE_ID_ENV_KEYS.pulse.annual] ?? null,
    },
    zenith: {
      monthly: process.env[PRICE_ID_ENV_KEYS.zenith.monthly] ?? null,
      annual: process.env[PRICE_ID_ENV_KEYS.zenith.annual] ?? null,
    },
  };
}

/** Ordre de gamme pour trier les abonnements (plus haut = mieux) */
function getPlanTierRank(planSlug: string | null): number {
  if (planSlug === 'zenith') return 3;
  if (planSlug === 'pulse') return 2;
  if (planSlug === 'vision') return 1;
  return 0;
}

/**
 * Parmi les abonnements actifs/trialing du client, retourne le "canonical" :
 * le plus haut de gamme, puis le plus récent.
 */
function pickCanonicalSubscription(subscriptions: Stripe.Subscription[]): Stripe.Subscription | null {
  const eligible = subscriptions.filter((s) => s.status === 'active' || s.status === 'trialing');
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const planA = getPlanSlugFromSubscription(a);
    const planB = getPlanSlugFromSubscription(b);
    const rankA = getPlanTierRank(planA);
    const rankB = getPlanTierRank(planB);
    if (rankB !== rankA) return rankB - rankA;
    return (b.created ?? 0) - (a.created ?? 0);
  });
  return eligible[0];
}

export async function POST(request: Request) {
  console.log('[stripe/webhook] Request received');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.log('[stripe/webhook] No stripe-signature header');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[stripe/webhook] Event received:', event.type, 'id:', event.id);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const planSlug = (session.metadata?.planSlug ?? 'pulse') as string;
      const validPlan = (['vision', 'pulse', 'zenith'].includes(planSlug) ? planSlug : 'pulse') as PlanSlug;
      const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[validPlan] ?? 'pulse';

      if (!subscriptionId) return NextResponse.json({ received: true });

      const subscription = await stripeWithRetry(
        (s) => s.subscriptions.retrieve(subscriptionId),
        secretKey
      );
      const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;
      const stripeStatus = subscription.status;
      const profileStatus = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : 'expired';

      const cust = session.customer as { email?: string } | string | null;
      const customerEmail =
        session.customer_details?.email ??
        (typeof cust === 'object' && cust?.email ? cust.email : undefined);
      const isAddEstablishmentFlow = session.metadata?.flow === 'add-establishment';
      const previousSubscriptionId = session.metadata?.previous_subscription_id as string | undefined;

      if (previousSubscriptionId && isAddEstablishmentFlow) {
        try {
          await stripeWithRetry((s) => s.subscriptions.cancel(previousSubscriptionId), secretKey);
        } catch (e) {
          console.error('[stripe/webhook] Cancel previous sub (add-establishment):', e);
        }
      }

      if (customerEmail && typeof customerEmail === 'string') {
        const admin = createAdminClient();
        if (admin) {
          const { data: profiles } = await admin
            .from('profiles')
            .select('id, establishment_name')
            .eq('email', customerEmail)
            .limit(1);
          if (profiles?.length) {
            const qty = getSubscriptionQuantity(subscription);
            const periodEnd = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null;
            await admin
              .from('profiles')
              .update({
                selected_plan: validPlan,
                subscription_plan: subscriptionPlan,
                subscription_status: profileStatus,
                subscription_quantity: qty,
                subscription_period_end: periodEnd,
                trial_ends_at: profileStatus === 'trialing' && trialEnd ? trialEnd.toISOString() : null,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
              })
              .eq('id', profiles[0].id);

            // Onboarding email : déclenché uniquement sur invoice.paid (pas ici)
          }
        }
      }
      revalidateDashboardPaths();
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionId = subscription.id;
      const admin = createAdminClient();
      if (admin) {
        const { data: profiles } = await admin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId);
        if (profiles?.length) {
          await admin
            .from('profiles')
            .update({
              subscription_plan: 'free',
              selected_plan: 'vision',
              subscription_status: 'canceled',
              subscription_quantity: 1,
              subscription_period_end: null,
              trial_ends_at: null,
              stripe_subscription_id: null,
              payment_status: 'paid',
              payment_failed_at: null,
            })
            .eq('id', profiles[0].id);
        }
      }
      revalidateDashboardPaths();
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const previousAttributes = (event.data as { previous_attributes?: Record<string, unknown> }).previous_attributes ?? {};
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (!customerId) return NextResponse.json({ received: true });

      const admin = createAdminClient();
      if (!admin) return NextResponse.json({ received: true });

      let allSubs = await stripeWithRetry(
        (s) => s.subscriptions.list({ customer: customerId, status: 'all', limit: 20 }),
        secretKey
      );
      let canonical = pickCanonicalSubscription(allSubs.data);
      if (!canonical) return NextResponse.json({ received: true });

      // Passage trialing → active : appliquer selected_plan (vision/pulse) en mettant à jour le prix Stripe si besoin
      const justBecameActive = previousAttributes.status === 'trialing' && subscription.status === 'active';
      if (justBecameActive) {
        let profilesForPlan = await admin
          .from('profiles')
          .select('id, selected_plan')
          .eq('stripe_customer_id', customerId)
          .limit(1);
        if (!profilesForPlan.data?.length) {
          profilesForPlan = await admin
            .from('profiles')
            .select('id, selected_plan')
            .eq('stripe_subscription_id', subscription.id)
            .limit(1);
        }
        const selectedPlan = (profilesForPlan.data?.[0]?.selected_plan as string) ?? 'zenith';
        const currentPlan = getPlanSlugFromSubscription(subscription);
        if ((selectedPlan === 'vision' || selectedPlan === 'pulse') && currentPlan !== selectedPlan) {
          const interval = getSubscriptionInterval(subscription);
          const planToPriceIds = getPlanSlugToStripePriceIds();
          const priceIds = planToPriceIds[selectedPlan as PlanSlug];
          const targetPriceId = interval === 'year' ? priceIds.annual : priceIds.monthly;
          const firstItem = subscription.items?.data?.[0];
          if (targetPriceId && firstItem?.id) {
            try {
              await stripeWithRetry(
                (s) => s.subscriptions.update(subscription.id, {
                  items: [{ id: firstItem.id, price: targetPriceId }],
                }),
                secretKey
              );
              allSubs = await stripeWithRetry(
                (s) => s.subscriptions.list({ customer: customerId, status: 'all', limit: 20 }),
                secretKey
              );
              canonical = pickCanonicalSubscription(allSubs.data) ?? canonical;
            } catch (err) {
              console.error('[stripe/webhook] Apply selected_plan price failed:', err);
            }
          }
        }
        // Si selected_plan === 'zenith', on ne fait rien : Stripe prélève le prix Zenith par défaut
      }

      const subscriptionId = canonical.id;
      const newPlanSlug = getPlanSlugFromSubscription(canonical);
      const qty = getSubscriptionQuantity(canonical);
      const stripeStatus = canonical.status;
      const profileStatus = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : stripeStatus === 'past_due' ? 'past_due' : 'expired';
      const trialEnd = canonical.trial_end ? new Date(canonical.trial_end * 1000) : null;
      const periodEnd = canonical.current_period_end
        ? new Date(canonical.current_period_end * 1000).toISOString()
        : null;
      const subscriptionPlan = (newPlanSlug && PLAN_SLUG_TO_SUBSCRIPTION[newPlanSlug]) ?? 'pulse';
      const selectedPlan = (newPlanSlug ?? 'vision') as PlanSlug;
      const planChanged = typeof previousAttributes.items !== 'undefined' && newPlanSlug;

      let profiles = await admin
        .from('profiles')
        .select('id, selected_plan, subscription_plan, subscription_quantity, establishment_name, email')
        .eq('stripe_customer_id', customerId)
        .limit(1);
      if (!profiles?.length) {
        profiles = await admin
          .from('profiles')
          .select('id, selected_plan, subscription_plan, subscription_quantity, establishment_name, email')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1);
      }
      if (!profiles?.length) {
        const { data: bySub } = await admin
          .from('profiles')
          .select('id, selected_plan, subscription_plan, subscription_quantity, establishment_name, email')
          .eq('stripe_subscription_id', subscription.id)
          .limit(1);
        if (bySub?.length) profiles = bySub;
      }

      if (profiles?.length) {
        const profile = profiles[0];
        const customerEmail = profile.email as string | undefined;
        const oldPlan = (profile.selected_plan ?? profile.subscription_plan) ?? '—';
        const oldQty = (profile.subscription_quantity as number | null) ?? null;

        const isPlanDowngrade = getPlanTierRank(oldPlan) > getPlanTierRank(selectedPlan);
        const isQuantityDowngrade = oldQty != null && oldQty > qty;
        const isDowngrade = isPlanDowngrade || isQuantityDowngrade;

        if (oldPlan !== selectedPlan) {
          console.log('[stripe/webhook] Plan mis à jour :', oldPlan, '->', selectedPlan);
        }
        if (oldQty !== null && oldQty !== qty) {
          console.log('[stripe/webhook] Nouvelle quantité :', oldQty, '->', qty);
        }

        await syncProfileFromSubscription(canonical, customerEmail ?? null);
        // Ne jamais supprimer les établissements en trop : seul subscription_quantity est mis à jour (accès limités, données conservées).

        const dashboardUrl = `${APP_URL}/fr/dashboard`;
        if (customerEmail) {
          if (isDowngrade) {
            sendDowngradeConfirmationEmail({
              to: customerEmail,
              quantity: qty,
              dashboardUrl,
            }).catch(() => {});
          } else if (planChanged) {
            const planName = PLAN_DISPLAY[newPlanSlug ?? ''] ?? 'Premium';
            const establishmentName = (profile.establishment_name as string) ?? '';
            sendUpgradeConfirmationEmail({
              to: customerEmail,
              planName,
              establishmentName,
              dashboardUrl,
            }).catch(() => {});
          }
        }
      }
      revalidateDashboardPaths();
      revalidateFullApp();
    }

    // Facture payée : déclencheur unique pour pending→active (sync quantity), création des slots "à configurer", email, revalidatePath.
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string; billing_reason?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (!subscriptionId) {
        console.log('[stripe/webhook] invoice.paid: no subscription id, skip');
        return NextResponse.json({ received: true });
      }

      const subscription = await retrieveSubscription(subscriptionId);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (!customerId) return NextResponse.json({ received: true });

      const admin = createAdminClient();
      if (admin) {
        let profiles = await admin
          .from('profiles')
          .select('id, email, establishment_name, subscription_quantity, language, onboarding_paid_sent')
          .eq('stripe_customer_id', customerId)
          .limit(1);
        if (!profiles?.data?.length) {
          const invoiceEmail = typeof invoice.customer_email === 'string' ? invoice.customer_email : null;
          if (invoiceEmail) {
            const { data: byEmail } = await admin
              .from('profiles')
              .select('id, email, establishment_name, subscription_quantity, language')
              .eq('email', invoiceEmail)
              .limit(1);
            if (byEmail?.length) {
              profiles = { data: byEmail };
              await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', byEmail[0].id);
            }
          }
        }
        const profileRow = profiles?.data?.[0];
        const oldQuantity = profileRow?.subscription_quantity as number | null;
        const oldQty = typeof oldQuantity === 'number' && oldQuantity >= 1 ? oldQuantity : null;
        const customerEmail = profileRow?.email as string | undefined;
        const userId = profileRow?.id as string | undefined;
        const onboardingAlreadySent = !!(profileRow as { onboarding_paid_sent?: boolean } | undefined)?.onboarding_paid_sent;

        await syncProfileFromSubscription(subscription, customerEmail ?? null);
        // Reset du statut de paiement sur toute facture payée
        if (subscriptionId) {
          await admin
            .from('profiles')
            .update({ subscription_status: 'active', payment_status: 'paid', payment_failed_at: null })
            .eq('stripe_subscription_id', subscriptionId);
        }

        const newQty = getSubscriptionQuantity(subscription);
        const addCount = newQty - (oldQty ?? 0);

        // Créer un slot "en attente" (needs_configuration) par nouvel emplacement payé
        if (userId && addCount > 0) {
          const { data: existing } = await admin
            .from('establishments')
            .select('display_order')
            .eq('user_id', userId)
            .order('display_order', { ascending: false })
            .limit(1);
          let nextOrder = (existing?.[0]?.display_order ?? -1) + 1;
          for (let i = 0; i < addCount; i++) {
            await admin.from('establishments').insert({
              user_id: userId,
              name: 'Nouvel emplacement en attente',
              display_order: nextOrder + i,
              needs_configuration: true,
            });
          }
        }

        const planSlug = getPlanSlugFromSubscription(subscription) ?? 'vision';
        const establishmentName = (profileRow?.establishment_name as string) ?? 'Votre établissement';
        const toEmail = customerEmail;
        if (!toEmail) {
          console.log('[stripe/webhook] invoice.paid: no profile found for customer', customerId, '(onboarding/facture emails skipped)');
        }

        if (toEmail && newQty > (oldQty ?? 0)) {
          const totalNextMonth = getTotalPrice(planSlug as PlanSlug, newQty, false);
          const dashboardUrl = `${APP_URL}/fr/dashboard/establishments`;
          sendEstablishmentAddedEmail({
            to: toEmail,
            establishmentName,
            totalNextMonth,
            dashboardUrl,
          }).catch((err) => console.error('[stripe/webhook] sendEstablishmentAddedEmail', err));
        }

        // Onboarding unique : facture de création ou premier paiement après essai
        const billingReason = invoice.billing_reason;
        if (toEmail && billingReason === 'subscription_create') {
          const isTrial = subscription.status === 'trialing';
          console.log('[stripe/webhook] Sending onboarding email (subscription_create):', { to: toEmail, isTrial, planSlug });
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null;
          const trialEndDate = trialEnd
            ? trialEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : null;
          const planName = PLAN_DISPLAY[planSlug as PlanSlug] ?? planSlug;
          const interval = getSubscriptionInterval(subscription);
          const invoiceUrl = invoice.hosted_invoice_url ?? null;
          const customerName = (profileRow?.establishment_name as string)?.trim() ?? '';
          const userLocale = (profileRow?.language as string) || 'fr';
          await sendReputexaOnboardingEmail({
            to: toEmail,
            customerName,
            planName,
            planSlug: planSlug as 'vision' | 'pulse' | 'zenith',
            trialEndDate,
            invoiceUrl,
            interval,
            isTrial,
            locale: userLocale,
          }).catch((err) => console.error('[stripe/webhook] sendReputexaOnboardingEmail', err));

          // Si pas d'essai, on considère que l'onboarding payant a été envoyé
          if (!isTrial && profileRow?.id && !onboardingAlreadySent) {
            await admin
              .from('profiles')
              .update({ onboarding_paid_sent: true })
              .eq('id', profileRow.id);
          }
        }

        // Passage essai → payant : premier invoice.paid "subscription_cycle" après un trial
        if (toEmail && billingReason === 'subscription_cycle' && !onboardingAlreadySent) {
          const isTrial = false;
          console.log('[stripe/webhook] Sending onboarding email (first paid after trial):', { to: toEmail, planSlug });
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null;
          const trialEndDate = trialEnd
            ? trialEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : null;
          const planName = PLAN_DISPLAY[planSlug as PlanSlug] ?? planSlug;
          const interval = getSubscriptionInterval(subscription);
          const invoiceUrl = invoice.hosted_invoice_url ?? null;
          const customerName = (profileRow?.establishment_name as string)?.trim() ?? '';
          const userLocale = (profileRow?.language as string) || 'fr';
          await sendReputexaOnboardingEmail({
            to: toEmail,
            customerName,
            planName,
            planSlug: planSlug as 'vision' | 'pulse' | 'zenith',
            trialEndDate,
            invoiceUrl,
            interval,
            isTrial,
            locale: userLocale,
          }).catch((err) => console.error('[stripe/webhook] sendReputexaOnboardingEmail', err));

          if (profileRow?.id) {
            await admin
              .from('profiles')
              .update({ onboarding_paid_sent: true })
              .eq('id', profileRow.id);
          }
        }

        // Facture récurrente (mois suivants) : email léger avec lien de téléchargement
        if (toEmail && billingReason === 'subscription_cycle' && onboardingAlreadySent) {
          const invoiceUrl = typeof invoice.hosted_invoice_url === 'string' ? invoice.hosted_invoice_url : null;
          const periodEnd = typeof invoice.period_end === 'number' ? invoice.period_end : null;
          const monthYear = periodEnd
            ? new Date(periodEnd * 1000).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            : new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
          if (invoiceUrl) {
            sendMonthlyInvoiceEmail({
              to: toEmail,
              monthYear,
              invoiceUrl,
            }).catch((err) => console.error('[stripe/webhook] sendMonthlyInvoiceEmail', err));
          }
        }
      }
      revalidateDashboardPaths();
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | undefined)?.id ?? null;

      const admin = createAdminClient();
      let customerEmail: string | null = null;
      let customerId: string | null = null;

      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer as Stripe.Customer | null)?.id ?? null;
        customerEmail =
          (typeof subscription.customer === 'object' && (subscription.customer as Stripe.Customer | null)?.email)
            ? (subscription.customer as Stripe.Customer).email ?? null
            : (typeof invoice.customer_email === 'string' && invoice.customer_email) ? invoice.customer_email : null;

        if (admin && customerId) {
          // Statut Stripe côté app : past_due + drapeau de paiement échoué (point de départ de la période de grâce)
          const failedAt = invoice.created ? new Date(invoice.created * 1000).toISOString() : new Date().toISOString();
          await admin
            .from('profiles')
            .update({ subscription_status: 'past_due', payment_status: 'unpaid', payment_failed_at: failedAt })
            .eq('stripe_subscription_id', subscriptionId);
        }
      } else {
        customerEmail =
          (typeof invoice.customer_email === 'string' && invoice.customer_email)
            ? invoice.customer_email
            : null;
      }

      if (customerEmail && customerId) {
        const dashboardBillingUrl = `${APP_URL}/fr/dashboard/settings#billing`;
        // Portail Stripe natif : l'utilisateur gère ses moyens de paiement et ses factures
        const portalBaseUrl = APP_URL.replace(/\/+$/, '');
        const portalUrl = `${portalBaseUrl}/api/stripe/portal?flow=upgrade`;

        sendPaymentFailedEmail({
          to: customerEmail,
          portalUrl,
          dashboardBillingUrl,
        }).catch((err) => console.error('[stripe/webhook] sendPaymentFailedEmail', err));
      }

      revalidateDashboardPaths();
    }

    if (event.type === 'invoice.payment_action_required') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
      const subscriptionId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : (invoice.subscription as Stripe.Subscription | undefined)?.id ?? null;

      const admin = createAdminClient();
      let customerEmail: string | null = null;

      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        customerEmail =
          typeof subscription.customer === 'object' && (subscription.customer as Stripe.Customer | null)?.email
            ? (subscription.customer as Stripe.Customer).email ?? null
            : (typeof invoice.customer_email === 'string' && invoice.customer_email) ? invoice.customer_email : null;

        if (admin && customerEmail) {
          const invoiceUrl = typeof invoice.hosted_invoice_url === 'string' ? invoice.hosted_invoice_url : null;
          if (invoiceUrl) {
            await sendPaymentActionRequiredEmail({
              to: customerEmail,
              invoiceUrl,
            }).catch((err) => console.error('[stripe/webhook] sendPaymentActionRequiredEmail', err));
          }
        }
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe/webhook] Handler failed:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    if (stack) console.error('[stripe/webhook] Stack:', stack);
    return NextResponse.json(
      { error: 'Webhook handler failed', details: msg },
      { status: 500 }
    );
  }
}
