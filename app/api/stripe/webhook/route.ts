import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getWelcomePremiumEmailHtml } from '@/lib/emails/templates';

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
                subscription_status: 'active',
                trial_ends_at: null,
              })
              .eq('id', profiles[0].id);

            if (canSendEmail()) {
              const establishmentName = (profiles[0].establishment_name as string) ?? '';
              const PLAN_DISPLAY: Record<string, string> = { vision: 'Vision', pulse: 'Pulse', zenith: 'ZENITH' };
              const planName = PLAN_DISPLAY[validPlan] ?? 'Premium';
              const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://reputexa.com';
              const loginUrl = `${appUrl}/fr/dashboard`;
              const html = getWelcomePremiumEmailHtml({ establishmentName, planName, loginUrl });
              sendEmail({
                to: customerEmail,
                subject: 'Bienvenue en Premium REPUTEXA — Votre abonnement est actif',
                html,
              }).catch(() => {});
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe/webhook]', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
