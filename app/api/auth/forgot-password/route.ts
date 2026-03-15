import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getPasswordRecoveryEmailHtml } from '@/lib/emails/templates';
import { getSiteUrl } from '@/lib/site-url';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { logForgotPasswordUrls } from '@/lib/debug-email-urls';

/**
 * Envoi d'un email de récupération de mot de passe (template Reputexa #2563eb).
 * Vérifie Turnstile + rate limit avant envoi.
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return NextResponse.json({ error: 'rateLimit' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';
    const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      return NextResponse.json({ error: 'captchaRequired' }, { status: 400 });
    }
    if (turnstileToken) {
      const valid = await verifyTurnstileToken(turnstileToken);
      if (!valid) {
        return NextResponse.json({ error: 'captchaVerifying' }, { status: 400 });
      }
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    // Redirect vers auth/callback (toujours dans les Redirect URLs Supabase) puis vers reset-password.
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? getSiteUrl();
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const callbackUrl = `${baseUrl}/${locale}/auth/callback?next=/reset-password`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: callbackUrl },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('user not found') || msg.includes('email not found') || msg.includes('with this email')) {
        return NextResponse.json({ sent: true });
      }
      console.error('[forgot-password]', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const raw = (data ?? {}) as Record<string, unknown>;
    const props = (raw.properties ?? raw) as Record<string, unknown>;
    const actionLink =
      (typeof props.action_link === 'string' ? props.action_link : null) ??
      (typeof props.recovery_link === 'string' ? props.recovery_link : null) ??
      (typeof raw.action_link === 'string' ? raw.action_link : null);
    if (!actionLink) {
      console.error('[forgot-password] no action_link in response', Object.keys(data ?? {}));
      return NextResponse.json({ error: 'Failed to generate link' }, { status: 500 });
    }

    logForgotPasswordUrls(email, locale, actionLink);

    if (!canSendEmail()) {
      console.log('[forgot-password] Resend non configuré — lien (dev):', actionLink);
      return NextResponse.json({ sent: false, reason: 'Email service not configured' }, { status: 200 });
    }

    const html = getPasswordRecoveryEmailHtml({ resetUrl: actionLink });
    const result = await sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe REPUTEXA',
      html,
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
