/**
 * Inscription : création utilisateur + OTP + lien magique — e-mail unique envoyé via **Resend** (template getVerifyEmailHtml).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateInternalUserPassword } from '@/lib/auth/internal-password';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { logSignupUrls } from '@/lib/debug-email-urls';
import { getVerifyEmailHtml } from '@/lib/emails/templates';
import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';
import { getEmailTemplatesTranslator } from '@/lib/emails/email-templates-i18n';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';
import { apiJsonError } from '@/lib/api/api-error-response';

const RESEND_FROM = process.env.RESEND_FROM ?? 'REPUTEXA <contact@reputexa.fr>';
const OTP_EXPIRY_MINUTES = 15;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return apiJsonError(request, 'auth_rateLimit', 429);
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    /** Zéro mot de passe côté client : secret serveur uniquement (exigence API Supabase). */
    const password = generateInternalUserPassword();
    const localeRaw = typeof body.locale === 'string' ? body.locale : 'fr';
    const emailLocale = normalizeEmailLocale(localeRaw);
    const signupMode = body.signupMode ?? body.signup_mode ?? 'trial';
    const isTrial = signupMode === 'trial';
    const subscriptionPlan = isTrial ? 'zenith' : (body.subscriptionPlan ?? body.subscription_plan ?? 'zenith');
    const selectedPlan = isTrial ? 'zenith' : (body.selectedPlan ?? body.selected_plan ?? 'zenith');
    const annual = isTrial ? false : (body.annual === true || body.annual === '1');
    const rawQty = body.quantity ?? body.checkout_quantity;
    const parsedQty =
      typeof rawQty === 'number'
        ? rawQty
        : parseInt(typeof rawQty === 'string' ? rawQty : '1', 10);
    const signupQuantity = Math.min(15, Math.max(1, Number.isFinite(parsedQty) ? parsedQty : 1));

    const metadata = {
      full_name: body.fullName ?? body.full_name ?? '',
      business_name: body.establishmentName ?? body.business_name ?? '',
      establishment_name: body.establishmentName ?? body.establishment_name ?? '',
      establishment_type: body.establishmentType ?? body.establishment_type ?? '',
      address: body.address ?? '',
      city: body.city ?? body.city_name ?? '',
      postal_code: body.postal_code ?? body.postcode ?? body.zip ?? '',
      country: body.country ?? '',
      phone: body.phone ?? '',
      subscription_plan: subscriptionPlan,
      selected_plan: selectedPlan,
      signup_mode: signupMode,
      signup_annual: annual,
      signup_quantity: signupQuantity,
    };

    if (!email) {
      return apiJsonError(request, 'auth_signup_emailRequired', 400);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 503);
    }

    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: metadata,
    });

    if (createError) {
      if (
        createError.message?.toLowerCase().includes('user already registered') ||
        createError.message?.toLowerCase().includes('already been registered') ||
        createError.message?.toLowerCase().includes('already exists')
      ) {
        return apiJsonError(request, 'auth_signup_accountExists', 400);
      }
      console.error('[signup] createUser:', createError);
      return apiJsonError(request, 'auth_signup_createUserFailed', 400);
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const userId = createData?.user?.id;
    if (!userId) {
      return apiJsonError(request, 'auth_signup_userNotCreated', 500);
    }

    const { error: insertError } = await admin.from('signup_otps').insert({
      user_id: userId,
      email,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error('[signup] insert signup_otps:', insertError);
      return apiJsonError(request, 'auth_signup_otpCreateFailed', 500);
    }

    logSignupUrls(email, emailLocale);

    let magicLink: string | undefined;
    try {
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      // Après clic sur le lien email → auth/callback → confirm-email pour la page de consentement
      const nextPath = `/confirm-email?email=${encodeURIComponent(email)}`;
      const redirectTo = `${baseUrl}/${emailLocale}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo },
      });
      magicLink = linkData?.properties?.action_link;
    } catch (e) {
      console.warn('[signup] generateLink (magic link) failed, OTP only:', e);
    }

    if (!canSendEmail()) {
      console.log('[signup] Resend non configuré — code OTP (dev):', otpCode);
      return NextResponse.json({
        ok: true,
        user: createData?.user,
        message: 'Compte créé. Code OTP (dev): ' + otpCode,
      });
    }

    const tMail = getEmailTemplatesTranslator(emailLocale);
    const html = getVerifyEmailHtml({ otpCode, confirmUrl: magicLink, email, locale: emailLocale });
    const result = await sendEmail({
      to: email,
      subject: tMail('verifyEmail.subject'),
      html,
      from: RESEND_FROM,
    });

    if (!result.success) {
      return apiJsonError(request, 'auth_signup_emailSendFailed', 500);
    }

    return NextResponse.json({ ok: true, user: createData?.user });
  } catch (e) {
    console.error('[signup]', e);
    return apiJsonError(request, 'auth_signup_failed', 500);
  }
}
