import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { checkContactRateLimit } from '@/lib/rate-limit';
import { apiJsonError } from '@/lib/api/api-error-response';
import {
  newsletterResendAudienceName,
  newsletterSenderStrategic,
  newsletterSiteUrl,
} from '@/lib/emails/newsletter-route-settings';
import { buildNewsletterWelcomeEmail } from '@/lib/emails/newsletter-emails-i18n';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { upsertNewsletterSubscriber } from '@/lib/blog-forge/newsletter-subscribers';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

let _resolvedAudienceId: string | null = process.env.RESEND_NEWSLETTER_AUDIENCE_ID ?? null;

async function resolveAudienceId(): Promise<string | null> {
  if (_resolvedAudienceId) return _resolvedAudienceId;
  if (!resend) return null;

  try {
    const { data: list, error: listError } = await resend.audiences.list();
    if (listError) {
      console.error('[newsletter/subscribe] audiences.list error:', JSON.stringify(listError));
    }

    const name = newsletterResendAudienceName();
    const existing = list?.data?.find((a: { name: string }) => a.name === name);

    if (existing?.id) {
      console.log(`[newsletter/subscribe] Found existing audience "${name}" → ${existing.id}`);
      _resolvedAudienceId = existing.id;
      return _resolvedAudienceId;
    }

    const { data: created, error: createError } = await resend.audiences.create({
      name,
    });

    if (createError || !created?.id) {
      console.error('[newsletter/subscribe] audiences.create error:', JSON.stringify(createError));
      return null;
    }

    console.log(
      `[newsletter/subscribe] Audience "${name}" créée → ${created.id}. Ajoutez RESEND_NEWSLETTER_AUDIENCE_ID=${created.id} à vos variables d'environnement.`
    );
    _resolvedAudienceId = created.id;
    return _resolvedAudienceId;
  } catch (err) {
    console.error('[newsletter/subscribe] resolveAudienceId unexpected error:', err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { ok: rateOk } = checkContactRateLimit(request);
    if (!rateOk) {
      return apiJsonError(request, 'auth_rateLimit', 429);
    }

    if (!resend) {
      console.warn('[newsletter/subscribe] RESEND_API_KEY not set');
      return apiJsonError(request, 'errors.resendNotConfigured', 503);
    }

    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? '').trim().toLowerCase();
    const locale = normalizeAppLocale(String(body?.locale ?? 'fr'));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return apiJsonError(request, 'errors.invalidEmail', 400);
    }

    await upsertNewsletterSubscriber(email, locale);

    const audienceId = await resolveAudienceId();

    if (audienceId) {
      const { error: contactError } = await resend.contacts.create({
        email,
        audienceId,
        unsubscribed: false,
      });
      if (contactError) {
        const msg = JSON.stringify(contactError).toLowerCase();
        if (!msg.includes('already') && !msg.includes('exist')) {
          console.error('[newsletter/subscribe] contacts.create error:', JSON.stringify(contactError, null, 2));
        } else {
          console.log(`[newsletter/subscribe] Contact already in audience: ${email}`);
        }
      }
    } else {
      console.warn('[newsletter/subscribe] Could not resolve audience ID — contact not added to audience');
    }

    const siteUrl = newsletterSiteUrl();
    const { subject, html } = buildNewsletterWelcomeEmail(locale, email, siteUrl);
    const { error: emailError } = await resend.emails.send({
      from: newsletterSenderStrategic(),
      to: email,
      subject,
      html,
    });

    if (emailError) {
      console.error('[newsletter/subscribe] Welcome email error:', JSON.stringify(emailError, null, 2));
    }

    console.log('[newsletter/subscribe] Subscribed:', email, locale);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[newsletter/subscribe] Unexpected error:', err);
    return apiJsonError(request, 'errors.unexpectedError', 500);
  }
}
