import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const TRIAL_DAYS = 14;

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY not configured' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const productId = process.env.STRIPE_PRODUCT_ID;
    if (!productId) {
      return NextResponse.json(
        { error: 'STRIPE_PRODUCT_ID not configured' },
        { status: 500 }
      );
    }

    const amountCents = Number(process.env.STRIPE_PRICE_AMOUNT_CENTS) || 7900; // 79€ par défaut

    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') ?? 'fr';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    let user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      const { sessionClaims } = await auth();
      const email = (sessionClaims?.email as string) ?? '';
      user = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email: email || `user-${userId}@placeholder.local`,
        },
      });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkUserId: userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const successUrl = `${baseUrl}/${locale}/dashboard?welcome=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/${locale}/checkout`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_collection: 'always',
      line_items: [
        {
          price_data: {
            product: productId,
            currency: 'eur',
            unit_amount: amountCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { userId: user.id },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe/checkout]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
