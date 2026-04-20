import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail, DEFAULT_FROM } from '@/lib/resend';
import { getAuthEmailHtml } from '@/lib/emails/templates';
import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';
import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { getBrandName } from '@/src/lib/empire-settings';
import { getSiteUrl } from '@/lib/site-url';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

/**
 * POST /api/auth/email-change
 * Génère un lien de confirmation de changement d'email via supabase admin,
 * puis l'envoie à la nouvelle adresse avec le template Reputexa.
 * Le SMTP par défaut Supabase doit être désactivé côté console.
 */
export async function POST(request: Request) {
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));
  try {
    const body = await request.json().catch(() => ({}));
    const newEmail =
      typeof body.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : '';
    const localeRaw = typeof body.locale === 'string' ? body.locale : 'fr';
    const emailLocale = normalizeEmailLocale(localeRaw);

    if (!newEmail) {
      return apiJsonError(request, 'auth_emailChange_newRequired', 400);
    }

    // Récupère l'utilisateur connecté via le cookie de session
    const supabase = await createClient();
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError || !user?.email) {
      return apiJsonError(request, 'auth_emailChange_sessionExpired', 401);
    }

    if (user.email === newEmail) {
      return apiJsonError(request, 'auth_emailChange_sameEmail', 400);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 503);
    }

    // Construction de l'URL de callback sécurisée
    const rawBaseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? getSiteUrl();
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const redirectTo = `${baseUrl}/${emailLocale}/auth/callback?next=/dashboard/settings`;

    // Génération du lien sécurisé via l'admin SDK (contourne le SMTP Supabase)
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'email_change_new',
      email: user.email,
      newEmail,
      options: { redirectTo },
    });

    if (error) {
      console.error('[email-change] generateLink error:', error);
      return apiJsonError(request, 'auth_emailChange_generateFailed', 400);
    }

    // Extraction de l'action_link dans la réponse admin
    const raw = (data ?? {}) as Record<string, unknown>;
    const props = (raw.properties ?? raw) as Record<string, unknown>;
    const actionLink =
      (typeof props.action_link === 'string' ? props.action_link : null) ??
      (typeof raw.action_link === 'string' ? raw.action_link : null);

    if (!actionLink) {
      console.error('[email-change] No action_link in response', Object.keys(data ?? {}));
      return apiJsonError(request, 'auth_emailChange_generateFailed', 500);
    }

    // Mode développement sans service email configuré
    if (!canSendEmail()) {
      console.log('[email-change] Service email non configuré — lien (dev):', actionLink);
      return NextResponse.json({ sent: false, reason: t('auth_emailChange_emailServiceNotConfigured') });
    }

    const tMail = getEmailTemplatesTranslator(emailLocale);
    const html = getAuthEmailHtml(actionLink, emailLocale);
    const result = await sendEmail({
      to: newEmail,
      subject: `${tMail('authEmailChange.title')} ${getBrandName()}`,
      html,
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    });

    if (!result.success) {
      console.error('[email-change] Email sending error:', result.error);
      return apiJsonError(request, 'auth_emailChange_sendFailed', 500);
    }

    return NextResponse.json({ sent: true });
  } catch (e) {
    console.error('[email-change]', e);
    return apiJsonError(request, 'auth_emailChange_requestFailed', 500);
  }
}
