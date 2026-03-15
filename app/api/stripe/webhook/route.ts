import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getUpgradeConfirmationEmailHtml, getWelcomePaidHtml, getWelcomeZenithTrialHtml } from '@/lib/emails/templates';
import { getPlanSlugFromSubscription, getSubscriptionQuantity } from '@/lib/stripe-subscription';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

const DASHBOARD_LOCALES = ['fr', 'en', 'es', 'de', 'it'] as const;

function revalidateDashboard() {
  try {
    for (const locale of DASHBOARD_LOCALES) {
      revalidatePath(`/${locale}/dashboard`, 'layout');
    }
    revalidatePath('/dashboard', 'layout');
  } catch (e) {
    console.error('[stripe/webhook] revalidatePath failed', e);
  }
}

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

/** Ordre de gamme pour trier les abonnements (plus haut = mieux) */
function getPlanTierRank(planSlug: string | null): number {
  if (planSlug === 'zenith') return 3;
  if (planSlug === 'pulse') return 2;
  if (planSlug === 'vision') return 1;
  return 0;
}

/**
 * Parmi les abonnements actifs/trialing du client, retourne le "canonical" :
 * le plus haut de gamme, puis le plus récent, pour éviter plusieurs abonnements et garder un seul ref.
 */
function pickCanonicalSubscription(subscriptions: Stripe.Subscription[]): Stripe.Subscription | null {
  const eligible = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trialing'
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const planA = getPlanSlugFromSubscription(a);
    const planB = getPlanSlugFromSubscription(b);
    const rankA = getPlanTierRank(planA);
    const rankB = getPlanTierRank(planB);
    if (rankB !== rankA) return rankB - rankA; // plus haut de gamme d'abord
    return (b.created ?? 0) - (a.created ?? 0); // puis plus récent
  });
  return eligible[0];
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const planSlug = (session.metadata?.planSlug ?? 'pulse') as string;
      const validPlan = ['vision', 'pulse', 'zenith'].includes(planSlug) ? planSlug : 'pulse';
      const subscriptionPlan = PLAN_SLUG_TO_SUBSCRIPTION[validPlan] ?? 'pulse';

      if (!subscriptionId) return NextResponse.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const trialEnd = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null;
      const stripeStatus = subscription.status; // 'trialing' | 'active' | 'canceled' | ...
      const profileStatus = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : 'expired';

      // Prisma
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeSubscriptionId: subscriptionId,
            trialEndsAt: trialEnd,
          },
        });
      }

      // Supabase: mettre à jour selected_plan pour que le cadenas disparaisse
      const cust = session.customer as { email?: string } | string | null;
      const customerEmail =
        session.customer_details?.email ??
        (typeof cust === 'object' && cust?.email ? cust.email : undefined);
      const isAddEstablishmentFlow = session.metadata?.flow === 'add-establishment';
      const previousSubscriptionId = session.metadata?.previous_subscription_id as string | undefined;

      if (previousSubscriptionId && isAddEstablishmentFlow) {
        try {
          await stripe.subscriptions.cancel(previousSubscriptionId);
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

            if (!isAddEstablishmentFlow && canSendEmail()) {
              const establishmentName = (profiles[0].establishment_name as string) ?? '';
              const planName = PLAN_DISPLAY[validPlan] ?? 'Premium';
              const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
              const loginUrl = `${appUrl}/fr/dashboard`;
              const settingsUrl = `${appUrl}/fr/dashboard/settings`;
              const supportUrl = `${appUrl}/fr/contact`;

              if (profileStatus === 'trialing') {
                const html = getWelcomeZenithTrialHtml({ loginUrl, settingsUrl, supportUrl });
                sendEmail({
                  to: customerEmail,
                  subject: "🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
                  html,
                  from: process.env.RESEND_FROM ?? DEFAULT_FROM,
                }).catch(() => {});
              } else {
                const html = getWelcomePaidHtml({
                  planName,
                  establishmentName,
                  loginUrl,
                  supportUrl,
                });
                sendEmail({
                  to: customerEmail,
                  subject: 'Merci pour votre confiance ! Votre surveillance 24/7 est activée.',
                  html,
                  from: process.env.RESEND_FROM ?? DEFAULT_FROM,
                }).catch(() => {});
              }
            }
          }
        }
      }
      revalidateDashboard();
    }

    // Abonnement supprimé : current_period_end est passé → on repasse en free
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
              subscription_status: 'expired',
              subscription_quantity: 1,
              subscription_period_end: null,
              trial_ends_at: null,
              stripe_subscription_id: null,
            })
            .eq('id', profiles[0].id);
        }
      }
      revalidateDashboard();
    }

    // customer.subscription.updated : quantité (établissements) et plan mis à jour dans profiles.
    // Déclenché par create-bulk-expansion (Stripe Expansion Engine) : après paiement de la facture,
    // subscription_quantity est déjà à jour, les nouveaux slots sont visibles au retour sur le dashboard.
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const previousAttributes = (event.data as { previous_attributes?: Record<string, unknown> }).previous_attributes ?? {};
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
      if (!customerId) return NextResponse.json({ received: true });

      const admin = createAdminClient();
      if (!admin) return NextResponse.json({ received: true });

      // Plusieurs abonnements actifs possibles : on ne garde que le plus récent / haut de gamme
      const allSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      });
      const canonical = pickCanonicalSubscription(allSubs.data);
      if (!canonical) return NextResponse.json({ received: true });

      const subscriptionId = canonical.id;
      // plan_id dérivé du premier item (subscription.items.data[0].price.id) — downgrade OK, Stripe gère le crédit
      const firstItemPriceId = canonical.items?.data?.[0]?.price?.id ?? null;
      const newPlanSlug = getPlanSlugFromSubscription(canonical);
      const qty = getSubscriptionQuantity(canonical);
      const stripeStatus = canonical.status;
      const profileStatus = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : stripeStatus === 'past_due' ? 'past_due' : 'expired';
      const trialEnd = canonical.trial_end ? new Date(canonical.trial_end * 1000) : null;
      const periodEnd = canonical.current_period_end
        ? new Date(canonical.current_period_end * 1000).toISOString()
        : null;
      const subscriptionPlan = (newPlanSlug && PLAN_SLUG_TO_SUBSCRIPTION[newPlanSlug]) ?? 'pulse';
      const selectedPlan = newPlanSlug ?? 'vision';
      const planChanged = typeof previousAttributes.items !== 'undefined' && newPlanSlug;

      // Trouver le profile par stripe_customer_id (prioritaire) ou par stripe_subscription_id
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
        const oldPlan = (profile.selected_plan ?? profile.subscription_plan) ?? '—';
        const oldQty = (profile.subscription_quantity as number | null) ?? null;

        // Logs clairs pour Vercel / debug
        if (oldPlan !== selectedPlan) {
          console.log('[stripe/webhook] Plan mis à jour :', oldPlan, '->', selectedPlan, '(price_id:', firstItemPriceId ?? '—', ')');
        }
        if (oldQty !== null && oldQty !== qty) {
          console.log('[stripe/webhook] Nouvelle quantité :', oldQty, '->', qty);
        }
        console.log('[stripe/webhook] customer.subscription.updated', {
          subscriptionId,
          customerId,
          status: stripeStatus,
          planSlug: newPlanSlug,
          quantity: qty,
          totalSubs: allSubs.data.length,
        });

        // Force sync : quantité et plan mis à jour immédiatement (downgrade = on met à jour, pas de blocage)
        await admin
          .from('profiles')
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            subscription_status: profileStatus,
            subscription_period_end: periodEnd,
            trial_ends_at: profileStatus === 'trialing' ? trialEnd?.toISOString() ?? null : null,
            selected_plan: selectedPlan,
            subscription_plan: subscriptionPlan,
            subscription_quantity: qty,
          })
          .eq('id', profile.id);

        if (planChanged && profile.email && canSendEmail()) {
          const planName = PLAN_DISPLAY[newPlanSlug ?? ''] ?? 'Premium';
          const establishmentName = (profile.establishment_name as string) ?? '';
          const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
          const dashboardUrl = `${appUrl}/fr/dashboard`;
          const html = getUpgradeConfirmationEmailHtml({
            planName,
            establishmentName,
            dashboardUrl,
          });
          sendEmail({
            to: profile.email as string,
            subject: 'Confirmation de mise à niveau — REPUTEXA',
            html,
            from: process.env.RESEND_FROM ?? DEFAULT_FROM,
          }).catch(() => {});
        }
      }
      revalidateDashboard();
    }

    // Facture payée (ex. après expansion) : synchroniser subscription_quantity pour afficher les nouveaux slots.
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const qty = getSubscriptionQuantity(subscription);
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
        const admin = createAdminClient();
        if (admin && customerId) {
          await admin
            .from('profiles')
            .update({ subscription_quantity: qty })
            .eq('stripe_customer_id', customerId);
        }
      }
      revalidateDashboard();
    }

    // Paiement échoué : passer subscription_status en past_due
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (subscriptionId) {
        const admin = createAdminClient();
        if (admin) {
          await admin
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);
        }
      }
      revalidateDashboard();
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
