import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { apiJsonError } from '@/lib/api/api-error-response';
import {
  newsletterResendAudienceName,
  newsletterSenderDefault,
  newsletterSiteUrl,
} from '@/lib/emails/newsletter-route-settings';
import { buildNewsletterUnsubscribeConfirmationEmail } from '@/lib/emails/newsletter-emails-i18n';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { markNewsletterUnsubscribed } from '@/lib/blog-forge/newsletter-subscribers';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const AUDIENCE_ID = process.env.RESEND_NEWSLETTER_AUDIENCE_ID ?? '';

async function doUnsubscribe(
  email: string,
  locale?: string | null
): Promise<{ ok: boolean; reason?: string }> {
  await markNewsletterUnsubscribed(email);

  if (!resend) {
    console.warn('[newsletter/unsubscribe] RESEND not configured — DB unsubscribed only');
    return { ok: true };
  }

  const audienceId = AUDIENCE_ID || (await resolveAudienceId());

  if (audienceId) {
    const { error } = await resend.contacts.remove({ audienceId, email });
    if (error) {
      const msg = JSON.stringify(error).toLowerCase();
      if (!msg.includes('not found') && !msg.includes('404')) {
        console.error('[newsletter/unsubscribe] remove error:', JSON.stringify(error, null, 2));
        return { ok: false, reason: 'remove_failed' };
      }
    }
  }

  const loc = normalizeAppLocale(locale);
  const site = newsletterSiteUrl();
  const { subject, html } = buildNewsletterUnsubscribeConfirmationEmail(loc, site);

  const { error: mailError } = await resend.emails.send({
    from: newsletterSenderDefault(),
    to: email,
    subject,
    html,
  });
  if (mailError) {
    console.error('[newsletter/unsubscribe] confirmation mail error:', JSON.stringify(mailError, null, 2));
  }

  return { ok: true };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { email?: string; locale?: string } | null;
    const clean = body?.email?.trim().toLowerCase() ?? '';
    if (!clean) return apiJsonError(request, 'newsletter_emailMissing', 400);

    const result = await doUnsubscribe(clean, body?.locale);
    if (!result.ok) {
      if (result.reason === 'not_configured') {
        return apiJsonError(request, 'errors.resendNotConfigured', 503);
      }
      return apiJsonError(request, 'errors.newsletterUnsubscribeRemoveFailed', 500);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[newsletter/unsubscribe POST]', err);
    return apiJsonError(request, 'errors.newsletterUnsubscribeInternal', 500);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase() ?? '';
  const loc = normalizeAppLocale(searchParams.get('locale'));
  const base = newsletterSiteUrl().replace(/\/$/, '');

  if (!email) {
    return NextResponse.redirect(`${base}/${loc}/newsletter/unsubscribe?status=invalid`, 302);
  }

  await doUnsubscribe(email, loc);
  return NextResponse.redirect(
    `${base}/${loc}/newsletter/unsubscribe?status=success&email=${encodeURIComponent(email)}`,
    302
  );
}

async function resolveAudienceId(): Promise<string | null> {
  if (!resend) return null;
  try {
    const { data } = await resend.audiences.list();
    const match = data?.data?.find((a: { name: string }) => a.name === newsletterResendAudienceName());
    return match?.id ?? null;
  } catch {
    return null;
  }
}
