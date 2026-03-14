import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { logSignupUrls } from '@/lib/debug-email-urls';
import { getVerifyEmailHtml } from '@/lib/emails/templates';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';

const RESEND_FROM = process.env.RESEND_FROM ?? 'REPUTEXA <contact@reputexa.fr>';
const OTP_EXPIRY_MINUTES = 15;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez patienter une minute.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';
    const signupMode = body.signupMode ?? body.signup_mode ?? 'trial';
    const isTrial = signupMode === 'trial';
    const subscriptionPlan = isTrial ? 'zenith' : (body.subscriptionPlan ?? body.subscription_plan ?? 'zenith');
    const selectedPlan = isTrial ? 'zenith' : (body.selectedPlan ?? body.selected_plan ?? 'zenith');

    const metadata = {
      full_name: body.fullName ?? body.full_name ?? '',
      business_name: body.establishmentName ?? body.business_name ?? '',
      establishment_name: body.establishmentName ?? body.establishment_name ?? '',
      establishment_type: body.establishmentType ?? body.establishment_type ?? '',
      address: body.address ?? '',
      phone: body.phone ?? '',
      subscription_plan: subscriptionPlan,
      selected_plan: selectedPlan,
      signup_mode: signupMode,
    };

    if (!email || !password) {
      return NextResponse.json({ error: 'email et mot de passe requis' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
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
        return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 400 });
      }
      console.error('[signup] createUser:', createError);
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const userId = createData?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non créé' }, { status: 500 });
    }

    const { error: insertError } = await admin.from('signup_otps').insert({
      user_id: userId,
      email,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error('[signup] insert signup_otps:', insertError);
      return NextResponse.json({ error: 'Échec de la création du code' }, { status: 500 });
    }

    logSignupUrls(email, locale);

    let magicLink: string | undefined;
    try {
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      const nextPath =
        signupMode === 'checkout'
          ? `/checkout?plan=${selectedPlan}&trial=0&auto=1`
          : `/checkout?plan=zenith&auto=1`;
      const redirectTo = `${baseUrl}/${locale}/auth/callback?next=${encodeURIComponent(nextPath)}`;
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

    const html = getVerifyEmailHtml({ otpCode, confirmUrl: magicLink });
    const result = await sendEmail({
      to: email,
      subject: 'Confirmez votre compte REPUTEXA',
      html,
      from: RESEND_FROM,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: createData?.user });
  } catch (e) {
    console.error('[signup]', e);
    return NextResponse.json({ error: 'Échec de l\'inscription' }, { status: 500 });
  }
}
