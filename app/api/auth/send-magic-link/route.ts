import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getMagicLinkEmailHtml } from '@/lib/emails/templates';
import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';
import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { logMagicLinkLoginUrls } from '@/lib/debug-email-urls';
import { apiJsonError } from '@/lib/api/api-error-response';
import { getInterfaceEmailSenderDefault } from '@/src/lib/empire-settings';

const RESEND_FROM = process.env.RESEND_FROM ?? getInterfaceEmailSenderDefault();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUserMissingError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('user not found') ||
    m.includes('not registered') ||
    m.includes('no user') ||
    m.includes('email not found') ||
    m.includes('with this email')
  );
}

/**
 * POST /api/auth/send-magic-link
 * Connexion sans SMTP Supabase : generateLink (magiclink) + envoi Resend + template Zenith.
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return apiJsonError(request, 'auth_rateLimit', 429);
    }

    const body = await request.json().catch(() => ({}));
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const localeRaw = typeof body.locale === 'string' ? body.locale : 'fr';
    const emailLocale = normalizeEmailLocale(localeRaw);
    const nextPath = typeof body.next === 'string' ? body.next.trim() : '';
    const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

    if (!emailRaw || !EMAIL_REGEX.test(emailRaw)) {
      return apiJsonError(request, 'auth_magicLink_invalidEmail', 400);
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      if (!turnstileToken) {
        return apiJsonError(request, 'authTurnstile_captchaRequired', 400);
      }
      const captchaOk = await verifyTurnstileToken(turnstileToken);
      if (!captchaOk) {
        return apiJsonError(request, 'authTurnstile_failed', 400);
      }
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 503);
    }

    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    const next =
      nextPath.startsWith('/') && !nextPath.startsWith('//')
        ? nextPath
        : `/${emailLocale}/dashboard`;
    const redirectTo = `${baseUrl}/${emailLocale}/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailRaw,
      options: { redirectTo },
    });

    if (error) {
      if (isUserMissingError(error.message ?? '')) {
        return NextResponse.json({ ok: true });
      }
      console.error('[send-magic-link] generateLink:', error);
      return apiJsonError(request, 'auth_magicLink_generateFailed', 400);
    }

    const raw = (data ?? {}) as Record<string, unknown>;
    const props = (raw.properties ?? raw) as Record<string, unknown>;
    const actionLink =
      (typeof props.action_link === 'string' ? props.action_link : null) ??
      (typeof raw.action_link === 'string' ? raw.action_link : null);

    if (!actionLink) {
      console.error('[send-magic-link] no action_link', Object.keys(data ?? {}));
      return apiJsonError(request, 'auth_magicLink_generateFailed', 500);
    }

    logMagicLinkLoginUrls(emailRaw, emailLocale, redirectTo, actionLink);

    if (!canSendEmail()) {
      console.log('[send-magic-link] Resend non configuré — lien (dev):', actionLink);
      return NextResponse.json({ ok: true, devLink: actionLink });
    }

    const tMail = getEmailTemplatesTranslator(emailLocale);
    const html = getMagicLinkEmailHtml({ actionUrl: actionLink, locale: emailLocale });
    const result = await sendEmail({
      to: emailRaw,
      subject: tMail('magicLink.subject'),
      html,
      from: RESEND_FROM,
    });

    if (!result.success) {
      return apiJsonError(request, 'auth_magicLink_sendFailed', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[send-magic-link]', e);
    return apiJsonError(request, 'auth_magicLink_requestFailed', 500);
  }
}
