import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';
import { getLanguageFromPhone } from '@/lib/language-from-phone';
import { apiJsonError } from '@/lib/api/api-error-response';

// Timeout generateLink Supabase : 5 s max (non-bloquant, fallback sessionStorage)
const GENERATE_LINK_TIMEOUT_MS = 5_000;

function normalizeOtpCode(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * POST /api/auth/verify-signup-otp
 *
 * Valide le code OTP et confirme l'email.
 * AUCUN appel Stripe ici : la session Stripe est créée côté client
 * quand l'utilisateur clique « Procéder au paiement » (via /api/stripe/create-checkout).
 *
 * Réponse succès : { ok, hashedToken, planSlug, annual, signupMode }
 *   - hashedToken : token Supabase pour verifyOtp() côté client (sans sessionStorage)
 *   - planSlug    : plan sélectionné à l'inscription
 *   - annual      : facturation annuelle ?
 *   - signupMode  : 'trial' | 'checkout'
 *
 * Réponse déjà abonné : { ok, redirectTo: '/dashboard?welcome=1', hashedToken }
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return apiJsonError(request, 'authOtp_rateLimitWait', 429);
    }

    const body = await request.json().catch(() => ({}));
    const email  = typeof body.email  === 'string' ? body.email.trim().toLowerCase() : '';
    const code   = normalizeOtpCode(typeof body.code  === 'string' ? body.code  : '');
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';

    if (!email || code.length !== 6) {
      return apiJsonError(request, 'authOtp_emailCodeRequired', 400);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 503);
    }

    // ── 1. Vérification OTP ───────────────────────────────────────────────────
    const { data: otpRows, error: selectError } = await admin
      .from('signup_otps')
      .select('id, user_id, code, expires_at')
      .eq('email', email);

    if (selectError) {
      console.error('[verify-signup-otp] select:', selectError.message);
      return apiJsonError(request, 'authOtp_verifyError', 500);
    }

    const GRACE_MS = 120_000;
    const now = Date.now();
    const otpRow = (otpRows ?? []).find((row: { code?: string; expires_at?: string }) => {
      const rowCode = normalizeOtpCode(row.code ?? '');
      if (rowCode !== code) return false;
      return new Date(row.expires_at ?? 0).getTime() + GRACE_MS > now;
    }) as { id: string; user_id: string } | undefined;

    if (!otpRow?.user_id) {
      const expired = (otpRows ?? []).find(
        (row: { code?: string }) => normalizeOtpCode(row.code ?? '') === code
      );
      return apiJsonError(
        request,
        expired ? 'authOtp_codeExpired' : 'authOtp_codeInvalid',
        400
      );
    }

    // ── 2. Confirmation email ─────────────────────────────────────────────────
    await admin.from('signup_otps').delete().eq('id', otpRow.id);

    const { error: updateError } = await admin.auth.admin.updateUserById(otpRow.user_id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('[verify-signup-otp] updateUserById:', updateError.message);
      return apiJsonError(request, 'authOtp_activationFailed', 500);
    }

    // ── 3. Lecture profil + metadata (parallèle pour aller plus vite) ─────────
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin
        .from('profiles')
        .select('subscription_status, selected_plan, stripe_subscription_id')
        .eq('id', otpRow.user_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(otpRow.user_id),
    ]);

    const meta = (authUser?.user?.user_metadata ?? {}) as {
      signup_mode?: string;
      selected_plan?: string;
      signup_annual?: boolean | string;
      signup_quantity?: number | string;
      phone?: string;
    };

    const signupMode: 'trial' | 'checkout' =
      meta.signup_mode === 'checkout' ? 'checkout' : 'trial';

    // Inférer la langue depuis le téléphone (best-effort, non-bloquant)
    if (typeof meta.phone === 'string' && meta.phone.trim()) {
      const lang = getLanguageFromPhone(meta.phone.trim());
      admin.from('profiles').update({ language: lang }).eq('id', otpRow.user_id).then(() => {});
    }

    const metaPlan = meta.selected_plan;
    const planSlug =
      metaPlan && ['vision', 'pulse', 'zenith'].includes(metaPlan) ? metaPlan : 'zenith';

    const annual =
      signupMode === 'checkout' &&
      (meta.signup_annual === true ||
        (typeof meta.signup_annual === 'string' && meta.signup_annual === 'true'));

    const rawQ = meta.signup_quantity;
    const parsedQ =
      typeof rawQ === 'number' ? rawQ : parseInt(typeof rawQ === 'string' ? rawQ : '1', 10);
    const quantity = Math.min(15, Math.max(1, Number.isFinite(parsedQ) ? parsedQ : 1));

    // ── 4. Token d'auth côté serveur (évite dépendance sessionStorage) ─────────
    const baseUrl = getSiteUrl().replace(/\/+$/, '');
    let hashedToken: string | null = null;
    try {
      const result = await Promise.race([
        admin.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: `${baseUrl}/${locale}/confirm-email?email=${encodeURIComponent(email)}`,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('generateLink timeout')),
            GENERATE_LINK_TIMEOUT_MS
          )
        ),
      ]);
      const props = result?.data?.properties as { hashed_token?: string } | null | undefined;
      hashedToken = props?.hashed_token ?? null;
    } catch (err) {
      console.warn(
        '[verify-signup-otp] generateLink non-fatal:',
        err instanceof Error ? err.message : err
      );
    }

    // ── 5. Déjà abonné via Stripe → dashboard ────────────────────────────────
    const stripeSubId = profile?.stripe_subscription_id;
    const alreadySubscribed =
      typeof stripeSubId === 'string' &&
      stripeSubId.length > 0 &&
      ['trialing', 'active', 'past_due'].includes(profile?.subscription_status ?? '');

    if (alreadySubscribed) {
      return NextResponse.json({ ok: true, redirectTo: '/dashboard?welcome=1', hashedToken });
    }

    // ── 6. Réponse : le client crée la session Stripe via /api/stripe/create-checkout ──
    return NextResponse.json({
      ok: true,
      hashedToken,
      planSlug,
      annual,
      signupMode,
      quantity,
    });
  } catch (e) {
    console.error('[verify-signup-otp] unexpected:', e instanceof Error ? e.message : e);
    return apiJsonError(request, 'authOtp_verifyFailedFinal', 500);
  }
}
