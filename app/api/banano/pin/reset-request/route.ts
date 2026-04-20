import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getBananoPinResetEmailHtml } from '@/lib/emails/templates';
import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { getSiteUrl } from '@/lib/site-url';
import {
  generatePinResetSecret,
  hashPinResetToken,
  PIN_RESET_TTL_MS,
} from '@/lib/banano/pin-reset-token';

const MAX_REQUESTS_PER_HOUR = 5;

/**
 * POST /api/banano/pin/reset-request
 * Utilisateur connecté : envoie un e-mail avec lien pour définir un nouveau PIN Banano.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const apiLoc = apiLocaleFromRequest(request);
  const tb = createServerTranslator('ApiBanano', apiLoc);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email?.trim()) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const body = await request.json().catch(() => ({}));
  const localeRaw = typeof body.locale === 'string' ? body.locale : 'fr';
  const locale = localeRaw.replace(/[^a-z-]/gi, '').slice(0, 5) || 'fr';
  const emailLocale = normalizeAppLocale(locale);
  const tEmail = getEmailTemplatesTranslator(emailLocale);

  const { data: profile, error: readErr } = await supabase
    .from('profiles')
    .select('banano_pin_hash')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) {
    console.error('[banano/pin/reset-request read]', readErr);
    return NextResponse.json({ error: tb('serverError') }, { status: 500 });
  }

  if (!profile?.banano_pin_hash) {
    return NextResponse.json({ error: tb('noPinSet') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tb('serviceUnavailable') }, { status: 503 });
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await admin
    .from('banano_pin_reset_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  if (cntErr) {
    console.error('[banano/pin/reset-request count]', cntErr);
    return NextResponse.json({ error: tb('serverError') }, { status: 500 });
  }

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return NextResponse.json({ error: tb('tooManyRequests') }, { status: 429 });
  }

  const raw = generatePinResetSecret();
  const token_hash = hashPinResetToken(raw);
  const expires_at = new Date(Date.now() + PIN_RESET_TTL_MS).toISOString();

  const { error: insErr } = await admin.from('banano_pin_reset_tokens').insert({
    user_id: user.id,
    token_hash,
    expires_at,
  });

  if (insErr) {
    console.error('[banano/pin/reset-request insert]', insErr);
    return NextResponse.json({ error: tb('saveFailed') }, { status: 500 });
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    getSiteUrl()
  ).replace(/\/+$/, '');
  const resetUrl = `${baseUrl}/${locale}/banano-pin-reset?token=${encodeURIComponent(raw)}`;

  if (!canSendEmail()) {
    console.log('[banano/pin/reset-request] dev — lien :', resetUrl);
    return NextResponse.json({ sent: false, reason: tb('emailServiceNotConfigured') });
  }

  const html = getBananoPinResetEmailHtml(resetUrl, emailLocale);
  const result = await sendEmail({
    to: user.email.trim(),
    subject: tEmail('bananoPinReset.subject'),
    html,
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
  });

  if (!result.success) {
    console.error('[banano/pin/reset-request send]', result);
    return NextResponse.json({ error: tb('sendEmailFailed') }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
