import { NextResponse } from 'next/server';

/**
 * Envoi email de bienvenue — DÉSACTIVÉ pour éviter les doublons.
 * Les emails WelcomePaid et WelcomeZenithTrial sont envoyés uniquement par le webhook Stripe
 * après checkout.session.completed.
 */
export async function POST() {
  return NextResponse.json(
    { sent: false, reason: 'Welcome emails sent by Stripe webhook only' },
    { status: 200 }
  );
}
