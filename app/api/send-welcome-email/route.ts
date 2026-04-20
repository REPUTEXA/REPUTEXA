import { NextResponse } from 'next/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';

/**
 * Envoi email de bienvenue — DÉSACTIVÉ. L'onboarding Reputexa est envoyé uniquement
 * par le webhook Stripe sur invoice.paid (point d'entrée unique).
 */
export async function POST(request: Request) {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  return NextResponse.json(
    { sent: false, reason: t('sendWelcome_webhookOnly') },
    { status: 200 }
  );
}
