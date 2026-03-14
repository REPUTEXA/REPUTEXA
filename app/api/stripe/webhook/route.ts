import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getEstablishmentAddedEmailHtml } from '@/lib/emails/templates';
import { getWelcomeZenithTrialHtml, getWelcomePaidHtml } from '@/lib/emails/react-welcome-templates';
import { toPlanSlug } from '@/lib/feature-gate';
import { getTotalMonthlyPrice } from '@/lib/establishments';

const PLAN_SLUG_TO_SUBSCRIPTION: Record<string, string> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};

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
      if (customerEmail && typeof customerEmail === 'string') {
        const admin = createAdminClient();
        if (admin) {
          const { data: profiles } = await admin
            .from('profiles')
            .select('id, establishment_name')
            .eq('email', customerEmail)
            .limit(1);
          if (profiles?.length) {
            await admin
              .from('profiles')
              .update({
                selected_plan: validPlan,
                subscription_plan: subscriptionPlan,
                subscription_status: profileStatus,
                trial_ends_at: profileStatus === 'trialing' && trialEnd ? trialEnd.toISOString() : null,
                stripe_subscription_id: subscriptionId,
                stripe_customer_id: customerId,
              })
              .eq('id', profiles[0].id);

            if (canSendEmail()) {
              const establishmentName = (profiles[0].establishment_name as string) ?? '';
              const PLAN_DISPLAY: Record<string, string> = { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' };
              const planName = PLAN_DISPLAY[validPlan] ?? 'Premium';
              const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';
              const loginUrl = `${appUrl}/fr/dashboard`;
              const settingsUrl = `${appUrl}/fr/dashboard/settings`;
              const guideUrl = `${appUrl}/fr/dashboard`;
              if (profileStatus === 'trialing') {
                const html = await getWelcomeZenithTrialHtml({ loginUrl, settingsUrl });
                sendEmail({
                  to: customerEmail,
                  subject: "🚀 C'est parti ! Tes 14 jours d'accès Total Zénith commencent.",
                  html,
                  from: process.env.RESEND_FROM ?? DEFAULT_FROM,
                }).catch(() => {});
              } else {
                const html = await getWelcomePaidHtml({
                  planName,
                  establishmentName,
                  loginUrl,
                  guideUrl,
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
    }

    // Abonnement annulé / expiré (essai terminé sans paiement, résiliation, etc.)
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
              trial_ends_at: null,
              stripe_subscription_id: null,
            })
            .eq('id', profiles[0].id);
        }
      }
    }

    // Synchroniser profiles quand le statut Stripe change (ex: trialing → active à la fin de l'essai)
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const subscriptionId = subscription.id;
      const stripeStatus = subscription.status;
      const profileStatus = stripeStatus === 'trialing' ? 'trialing' : stripeStatus === 'active' ? 'active' : 'expired';
      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

      const admin = createAdminClient();
      if (admin) {
        await admin
          .from('profiles')
          .update({
            subscription_status: profileStatus,
            trial_ends_at: profileStatus === 'trialing' ? trialEnd?.toISOString() ?? null : null,
          })
          .eq('stripe_subscription_id', subscriptionId);
      }
    }

    // Addon prorata : paiement réussi → créer l'établissement, envoyer l'email
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      const customerId = invoice.customer as string | null;

      if (subscriptionId && customerId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const pendingRaw = subscription.metadata?.pendingAddon;
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as {
              userId: string;
              name: string;
              address: string | null;
              googleLocationId: string | null;
              googleLocationName: string | null;
              googleLocationAddress: string | null;
              displayOrder: number;
            };

            const admin = createAdminClient();
            if (admin) {
              const { data: inserted, error } = await admin
                .from('establishments')
                .insert({
                  user_id: pending.userId,
                  name: pending.name,
                  address: pending.address,
                  google_location_id: pending.googleLocationId,
                  google_location_name: pending.googleLocationName,
                  google_location_address: pending.googleLocationAddress,
                  google_connected_at: pending.googleLocationId ? new Date().toISOString() : null,
                  display_order: pending.displayOrder,
                })
                .select('id, name')
                .single();

              if (!error && inserted) {
                const { data: profile } = await admin
                  .from('profiles')
                  .select('subscription_plan, selected_plan')
                  .eq('id', pending.userId)
                  .single();

                const planSlug = toPlanSlug(
                  profile?.subscription_plan ?? null,
                  profile?.selected_plan ?? null
                );
                const { count } = await admin
                  .from('establishments')
                  .select('id', { head: true, count: 'exact' })
                  .eq('user_id', pending.userId);
                const totalNextMonth = getTotalMonthlyPrice(planSlug, count ?? 0);
                const customer = await stripe.customers.retrieve(customerId);
                const customerEmail = (customer && !('deleted' in customer) && customer.email) || invoice.customer_email;
                const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.fr';

                if (customerEmail && canSendEmail()) {
                  const html = getEstablishmentAddedEmailHtml({
                    establishmentName: pending.name,
                    totalNextMonth,
                    dashboardUrl: `${appUrl}/fr/dashboard/establishments`,
                  });
                  sendEmail({
                    to: customerEmail,
                    subject: 'Nouvel établissement ajouté - Reputexa',
                    html,
                    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
                  }).catch(() => {});
                }

                await stripe.subscriptions.update(subscriptionId, {
                  metadata: { pendingAddon: '' },
                });
              }
            }
          } catch (e) {
            console.error('[stripe/webhook] invoice.paid pendingAddon', e);
          }
        }
      }
    }

    // Paiement échoué : passer subscription_status en past_due
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (subscription.metadata?.pendingAddon) {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: { pendingAddon: '' },
          });
        }
        const admin = createAdminClient();
        if (admin) {
          await admin
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe/webhook]', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
