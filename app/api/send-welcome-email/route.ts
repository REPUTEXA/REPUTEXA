import { NextResponse } from 'next/server';

/**
 * Envoi email de bienvenue — DÉSACTIVÉ. L'onboarding Reputexa est envoyé uniquement
 * par le webhook Stripe sur invoice.paid (point d'entrée unique).
 */
export async function POST() {
  return NextResponse.json(
    { sent: false, reason: 'Welcome emails sent by Stripe webhook only' },
    { status: 200 }
  );
}
