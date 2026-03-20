import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail, sendEmail } from '@/lib/resend';
import { getVerifyEmailHtml } from '@/lib/emails/templates';
import { checkAuthRateLimit } from '@/lib/rate-limit';

const RESEND_FROM = process.env.RESEND_FROM ?? 'REPUTEXA <contact@reputexa.fr>';
const OTP_EXPIRY_MINUTES = 15;

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Renvoie un nouveau code OTP par email pour la confirmation d'inscription.
 * Invalide les anciens codes pour cet email.
 */
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

    if (!email) {
      return NextResponse.json({ error: 'Email requis.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service indisponible' }, { status: 503 });
    }

    let userId: string | null = null;

    // Utiliser limit(1) au lieu de maybeSingle() : si plusieurs OTP (double-clic, etc.), maybeSingle()
    // renvoie une erreur et on rate le fallback, d'où "Aucun compte en attente" alors qu'on vient de s'inscrire
    const { data: otpRows } = await admin
      .from('signup_otps')
      .select('user_id')
      .eq('email', email)
      .limit(1);

    const existingOtp = Array.isArray(otpRows) ? otpRows[0] : null;
    if (existingOtp?.user_id) {
      userId = existingOtp.user_id;
    }

    if (!userId) {
      const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const user = listData?.users?.find(
        (u) => u.email?.toLowerCase() === email && !u.email_confirmed_at
      );
      userId = user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Aucun code en attente pour cet email. Vérifiez l'adresse, ou attendez quelques secondes et réessayez si vous venez de créer votre compte.",
        },
        { status: 400 }
      );
    }
    await admin.from('signup_otps').delete().eq('email', email);

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const { error: insertError } = await admin.from('signup_otps').insert({
      user_id: userId,
      email,
      code: otpCode,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error('[resend-signup-otp] insert:', insertError);
      return NextResponse.json({ error: 'Erreur lors de la création du code.' }, { status: 500 });
    }

    if (!canSendEmail()) {
      console.log('[resend-signup-otp] Resend non configuré — code (dev):', otpCode);
      return NextResponse.json({ ok: true, message: 'Code renvoyé (dev): ' + otpCode });
    }

    const html = getVerifyEmailHtml({ otpCode, email });
    const result = await sendEmail({
      to: email,
      subject: 'Nouveau code de vérification REPUTEXA',
      html,
      from: RESEND_FROM,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[resend-signup-otp]', e);
    return NextResponse.json({ error: 'Erreur lors du renvoi du code.' }, { status: 500 });
  }
}
