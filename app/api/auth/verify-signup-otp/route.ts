import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getSiteUrl } from '@/lib/site-url';
import { getStripePriceId, type PlanSlug } from '@/config/pricing';

const TRIAL_DAYS = 14;

/** Normalise le code : uniquement les 6 chiffres (espaces, unicode, etc. supprimés) */
function normalizeOtpCode(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * Vérifie le code OTP de confirmation d'inscription.
 * Si valide : confirme l'email. Pas de magic link — le client se connecte via signInWithPassword.
 */
export async function POST(request: Request) {
  try {
    const rateLimit = checkAuthRateLimit(request);
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: 'Sécurité activée : Patientez 60 secondes avant de retaper le code.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = normalizeOtpCode(typeof body.code === 'string' ? body.code : '');
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';

    if (!email || code.length !== 6) {
      return NextResponse.json(
        { error: 'Email et code à 6 chiffres requis.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const { data: otpRows, error: selectError } = await admin
      .from('signup_otps')
      .select('id, user_id, code, expires_at')
      .eq('email', email);

    if (selectError) {
      console.error('[verify-signup-otp] select:', selectError);
      return NextResponse.json(
        { error: 'Erreur de vérification. Réessayez.' },
        { status: 500 }
      );
    }

    const GRACE_MS = 120 * 1000;
    const now = Date.now();
    const otpRow = (otpRows ?? []).find((row: { code?: string; expires_at?: string }) => {
      const rowCode = normalizeOtpCode(row.code ?? '');
      if (rowCode !== code) return false;
      const expiresAt = new Date(row.expires_at ?? 0).getTime();
      return expiresAt + GRACE_MS > now;
    }) as { id: string; user_id: string } | undefined;

    if (!otpRow?.user_id) {
      const expiredMatch = (otpRows ?? []).find((row: { code?: string }) =>
        normalizeOtpCode(row.code ?? '') === code
      );
      const msg = expiredMatch
        ? 'Ce code a expiré. Cliquez sur « Renvoyer un nouveau code » ci-dessous.'
        : 'Code incorrect. Vérifiez le code à 6 chiffres ou demandez un nouveau code.';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await admin.from('signup_otps').delete().eq('id', otpRow.id);

    const { error: updateError } = await admin.auth.admin.updateUserById(otpRow.user_id, {
      email_confirm: true,
    });

    if (updateError) {
      console.error('[verify-signup-otp] updateUserById:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de l\'activation. Réessayez ou contactez le support.' },
        { status: 500 }
      );
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status, full_name, establishment_name, selected_plan')
      .eq('id', otpRow.user_id)
      .maybeSingle();

    // FORCER extraction depuis user_metadata (source de vérité à l'inscription)
    const { data: authUser } = await admin.auth.admin.getUserById(otpRow.user_id);
    const meta = (authUser?.user?.user_metadata ?? {}) as { signup_mode?: string; selected_plan?: string; signup_annual?: boolean };
    const signupMode: 'trial' | 'checkout' = meta?.signup_mode === 'checkout' ? 'checkout' : 'trial';
    const metaPlan = meta?.selected_plan;
    const selectedPlan = (metaPlan && ['vision', 'pulse', 'zenith'].includes(metaPlan))
      ? metaPlan
      : (profile?.selected_plan ?? 'zenith');
    const annual = signupMode === 'checkout' && (meta?.signup_annual === true || meta?.signup_annual === 'true');

    const isTrialing = profile?.subscription_status === 'trialing';

    // Pas d'email de bienvenue ici : le webhook Stripe envoie WelcomePaid ou WelcomeZenithTrial
    // après checkout.session.completed pour éviter les doublons.

    if (isTrialing) {
      return NextResponse.json({ ok: true, redirectTo: '/dashboard' });
    }

    // Créer la session Stripe — TOUJOURS renvoyer stripeUrl, jamais /checkout ou /choose-plan
    // Trial → price mensuel Zenith + 14 jours. Checkout → price mensuel ou annuel selon signup_annual (choix gravé depuis la landing/pricing).
    const plan = (['vision', 'pulse', 'zenith'].includes(selectedPlan) ? selectedPlan : 'zenith') as PlanSlug;
    const skipTrial = signupMode === 'checkout';
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = getStripePriceId(plan, annual);

    if (!secretKey || !priceId) {
      console.error('[verify-signup-otp] STRIPE_SECRET_KEY ou priceId manquant', { plan, annual });
      return NextResponse.json(
        {
          error: annual
            ? 'Tarif annuel non configuré pour ce plan. Contactez le support ou réessayez en facturation mensuelle.'
            : 'Configuration paiement indisponible. Contactez le support.',
        },
        { status: 500 }
      );
    }

    try {
      const stripe = new Stripe(secretKey);
      const baseUrl = getSiteUrl().replace(/\/+$/, '');
      const statusParam = skipTrial ? 'success' : 'trial_started';
      const successUrl = `${baseUrl}/api/stripe/checkout-success?session_id={CHECKOUT_SESSION_ID}&locale=${locale}&plan=${plan}&status=${statusParam}`;
      const cancelUrl = `${baseUrl}/${locale}/pricing?plan=${plan}&annual=${annual ? '1' : '0'}&status=cancelled`;

      let customerId: string | null = null;
      const existing = await stripe.customers.list({ email, limit: 1 });
      customerId = existing.data[0]?.id ?? null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { supabaseUserId: otpRow.user_id },
        });
        customerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_collection: 'always',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { planSlug: plan },
          ...(skipTrial ? {} : { trial_period_days: TRIAL_DAYS }),
        },
        metadata: { planSlug: plan },
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
      });

      if (!session.url) {
        throw new Error('Stripe n\'a pas renvoyé d\'URL de checkout');
      }
      return NextResponse.json({ ok: true, stripeUrl: session.url });
    } catch (error) {
      console.error('ERREUR STRIPE COMPLETE:', error);
      console.error('[verify-signup-otp] Stripe session:', error);
      return NextResponse.json(
        { error: 'Impossible de créer la session de paiement. Réessayez ou contactez le support.' },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error('[verify-signup-otp]', e);
    return NextResponse.json({ error: "Échec de la vérification" }, { status: 500 });
  }
}
