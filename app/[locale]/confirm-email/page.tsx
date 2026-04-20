'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandLoadingOverlay } from '@/components/brand/brand-page-loader';
import { Logo } from '@/components/logo';
import { OtpInput } from '@/components/auth/otp-input';
import { KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { consumeSignupPending } from '@/lib/auth/signup-pending';
import { purgeClientCachesForNewAccount } from '@/lib/auth/client-storage-cleanup';
import { motion } from 'framer-motion';
import { PasskeyEnrollButton } from '@/components/auth/passkey-enroll-button';
import { withLocalePrefix } from '@/lib/i18n/with-locale-prefix';
import {
  isStripeValidationErrorCode,
  stripeValidationErrorToApiStripeKey,
} from '@/lib/validations/stripe-api-error';

/** Valeur d’easing Framer Motion (API), pas une chaîne affichée. */
const CONFIRM_EMAIL_MOTION_EASE = 'easeInOut' as const;

type Step = 'verify' | 'consent' | 'redirecting';

function normalizeOtpCode(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * Email confirmation page (6-digit OTP).
 *
 * Flow:
 *  1. POST /api/auth/verify-signup-otp — confirms email, returns { hashedToken, planSlug, annual, signupMode }
 *     (no Stripe here → fast response)
 *  2. Client session: verifyOtp(hashedToken); fallback signInWithPassword + sessionStorage
 *  3. Consent screen: terms + Zenith GDPR clause when plan is Zenith
 *  4. “Continue to payment” → save consent → POST /api/stripe/create-checkout → Stripe
 */
export default function ConfirmEmailPage() {
  const locale = useLocale();
  const t = useTranslations('ConfirmEmail');
  const tPricing = useTranslations('PricingPage');
  const tStripeErr = useTranslations('ApiStripe.errors');
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams?.get('email') ?? '';

  const [email, setEmail] = useState('');
  const [code, setCode]   = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [step, setStep]                   = useState<Step>('verify');
  const [pendingPlanSlug, setPendingPlanSlug]   = useState('');
  const [pendingAnnual, setPendingAnnual]       = useState(false);
  const [pendingSignupMode, setPendingSignupMode] = useState<'trial' | 'checkout'>('trial');
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [acceptedCgu, setAcceptedCgu]       = useState(false);
  const [acceptedZenith, setAcceptedZenith] = useState(false);
  const [payPhase, setPayPhase] = useState<'proceed' | 'saving' | 'stripe'>('proceed');

  const requestSent = useRef(false);
  const formRef     = useRef<HTMLFormElement>(null);

  const legalAcceptCheckboxRich = useMemo(
    () =>
      tPricing.rich('legalAcceptCheckbox', {
        terms: (chunks) => (
          <Link
            href="/legal/cgu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2563eb] underline underline-offset-2 hover:text-[#1d4ed8]"
          >
            {chunks}
          </Link>
        ),
        privacy: (chunks) => (
          <Link
            href="/legal/confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#2563eb] underline underline-offset-2 hover:text-[#1d4ed8]"
          >
            {chunks}
          </Link>
        ),
      }),
    [tPricing]
  );

  // Safety: if isLoading stays true > 35s, release the lock (stalled network / no timeout).
  useEffect(() => {
    if (!isLoading) return;
    const timerId = setTimeout(() => {
      requestSent.current = false;
      setIsLoading(false);
      toast.error(t('toastVerifyTimeout'));
    }, 35_000);
    return () => clearTimeout(timerId);
  }, [isLoading, t]);

  // Pre-fill email from query string
  useEffect(() => {
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery).trim().toLowerCase());
    }
  }, [emailFromQuery]);

  // Magic-link path: user already has a session from auth/callback. If not subscribed yet, show consent.
  useEffect(() => {
    let cancelled = false;
    async function checkExistingSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, stripe_subscription_id, selected_plan')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;

      const stripeSubId = profile?.stripe_subscription_id;
      const alreadySubscribed =
        typeof stripeSubId === 'string' &&
        stripeSubId.length > 0 &&
        ['trialing', 'active', 'past_due'].includes(profile?.subscription_status ?? '');

      if (alreadySubscribed) {
        window.location.replace(`/${locale}/dashboard?welcome=1`);
        return;
      }

      const meta = user.user_metadata as {
        selected_plan?: string;
        signup_mode?: string;
        signup_annual?: boolean | string;
        signup_quantity?: number | string;
      } | undefined;
      const metaPlan = meta?.selected_plan;
      const planSlug = metaPlan && ['vision', 'pulse', 'zenith'].includes(metaPlan) ? metaPlan : 'zenith';
      const signupMode: 'trial' | 'checkout' = meta?.signup_mode === 'checkout' ? 'checkout' : 'trial';
      const annual =
        signupMode === 'checkout' &&
        (meta?.signup_annual === true || meta?.signup_annual === 'true');
      const rawQ = meta?.signup_quantity;
      const pq =
        typeof rawQ === 'number' ? rawQ : parseInt(typeof rawQ === 'string' ? rawQ : '1', 10);
      const qty = Math.min(15, Math.max(1, Number.isFinite(pq) ? pq : 1));

      // Logged in but no subscription yet (magic link: auth/callback → confirm-email)
      setPendingPlanSlug(planSlug);
      setPendingAnnual(annual);
      setPendingSignupMode(signupMode);
      setPendingQuantity(qty);
      setStep('consent');
    }
    // Only when user is not mid-OTP entry
    if (step === 'verify' && !isLoading && !requestSent.current) {
      checkExistingSession();
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill code from ?code= (email link)
  useEffect(() => {
    const c = normalizeOtpCode(searchParams?.get('code') ?? '');
    if (c.length === 6) setCode(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-submit when code came from email link
  useEffect(() => {
    const c = normalizeOtpCode(searchParams?.get('code') ?? '');
    if (c.length !== 6 || !email || requestSent.current) return;
    const submitTimer = setTimeout(() => {
      if (!requestSent.current) formRef.current?.requestSubmit();
    }, 150);
    return () => clearTimeout(submitTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleCodeChange = useCallback((v: string) => {
    setCode(v);
    // Do not setIsLoading(true) here: keep the form mounted so requestSubmit() runs onSubmit → handleSubmit.
    if (normalizeOtpCode(v).length === 6 && !requestSent.current) {
      formRef.current?.requestSubmit();
    }
  }, []);

  // ── Step 1: OTP verification (no Stripe) ─────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestSent.current) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode  = normalizeOtpCode(code);
    if (!trimmedEmail || trimmedCode.length !== 6) return;

    requestSent.current = true;
    setIsLoading(true);

    try {
      // API call with 15s abort
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 15_000);

      const res = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, code: trimmedCode, locale }),
        signal: controller.signal,
      }).finally(() => clearTimeout(abortTimer));

      const json = await res.json().catch(() => ({}));

      if (res.status === 429) {
        toast.error(json.error ?? t('toastRateLimitOtp'));
        setTimeout(() => { requestSent.current = false; setIsLoading(false); }, 5000);
        return;
      }
      if (!res.ok) {
        requestSent.current = false;
        setIsLoading(false);
        toast.error(json.error ?? t('toastVerifyFailed'));
        return;
      }

      // ── Establish session ──────────────────────────────────────────────────
      purgeClientCachesForNewAccount();
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'local' });

      let signedIn = false;

      // Method 1: server-issued token (no sessionStorage)
      const hashedToken =
        typeof json.hashedToken === 'string' && json.hashedToken.length > 0
          ? json.hashedToken : null;

      if (hashedToken) {
        try {
          const { error: otpErr } = await Promise.race([
            supabase.auth.verifyOtp({ token_hash: hashedToken, type: 'magiclink' }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('verifyOtp timeout')), 10_000)
            ),
          ]);
          if (!otpErr) signedIn = true;
          else console.warn('[confirm-email] verifyOtp:', otpErr.message);
        } catch (err) {
          console.warn('[confirm-email] verifyOtp timeout:', err instanceof Error ? err.message : err);
        }
      }

      // Method 2: sessionStorage + signInWithPassword (fallback, 12s max)
      if (!signedIn) {
        const pending = consumeSignupPending(trimmedEmail);
        if (pending?.password) {
          try {
            const { error: signInErr } = await Promise.race([
              supabase.auth.signInWithPassword({ email: trimmedEmail, password: pending.password }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('signInWithPassword timeout')), 12_000)
              ),
            ]);
            if (!signInErr) signedIn = true;
            else console.warn('[confirm-email] signInWithPassword:', signInErr.message);
          } catch (err) {
            console.warn('[confirm-email] signInWithPassword timeout/err:', err instanceof Error ? err.message : err);
          }
        }
      }

      // Method 3: email confirmed but no session → redirect to /login for magic link
      if (!signedIn) {
        requestSent.current = false;
        setIsLoading(false);
        toast.success(t('toastAccountActivatedMagicLink'), { duration: 9000 });
        window.location.replace(`/${locale}/login?email=${encodeURIComponent(trimmedEmail)}&message=confirm-email`);
        return;
      }

      // ── Routing ────────────────────────────────────────────────────────────
      const redirectTo = typeof json.redirectTo === 'string' ? json.redirectTo : '';

      // Already subscribed → dashboard
      if (redirectTo.startsWith('/')) {
        window.location.replace(withLocalePrefix(locale, redirectTo, '/dashboard'));
        return;
      }

      // New account → consent screen
      const planSlug   = typeof json.planSlug   === 'string' ? json.planSlug   : 'zenith';
      const annual     = json.annual === true || json.annual === 'true';
      const signupMode = json.signupMode === 'checkout' ? 'checkout' : 'trial';
      const qRaw = json.quantity;
      const qParsed =
        typeof qRaw === 'number' ? qRaw : parseInt(typeof qRaw === 'string' ? qRaw : '1', 10);
      const qty = Math.min(15, Math.max(1, Number.isFinite(qParsed) ? qParsed : 1));

      setPendingPlanSlug(planSlug);
      setPendingAnnual(annual);
      setPendingSignupMode(signupMode);
      setPendingQuantity(qty);
      setIsLoading(false);
      requestSent.current = false;
      setStep('consent');
    } catch (err) {
      requestSent.current = false;
      setIsLoading(false);
      const isAbort = err instanceof Error && err.name === 'AbortError';
      toast.error(isAbort ? t('toastVerifyAbort') : t('toastVerifyNetwork'));
    }
  }, [email, code, locale, t]);

  // ── Step 2: payment (Stripe after consent) ───────────────────────────────────
  const handleProceedToPayment = useCallback(async () => {
    if (!pendingPlanSlug) return;
    setPayPhase('saving');

    // Consent + audit trail (timestamp / legal version) via API
    try {
      const isZenithPlan = pendingPlanSlug === 'zenith';
      const complianceRes = await fetch('/api/profile/accept-merchant-compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          mode: 'pre_checkout',
          zenithAttested: isZenithPlan && acceptedZenith,
        }),
      });
      const complianceJson = await complianceRes.json().catch(() => ({}));
      if (!complianceRes.ok) {
        toast.error(
          typeof complianceJson.error === 'string' ? complianceJson.error : t('toastComplianceGeneric'),
        );
        setPayPhase('proceed');
        return;
      }
    } catch (err) {
      console.warn('[confirm-email] accept-merchant-compliance:', err);
      toast.error(t('toastComplianceNetwork'));
      setPayPhase('proceed');
      return;
    }

    // Créer la session Stripe
    try {
      setPayPhase('stripe');
      const skipTrial = pendingSignupMode === 'checkout' ? '1' : '0';
      const params = new URLSearchParams({
        locale,
        planSlug: pendingPlanSlug,
        annual: pendingAnnual ? '1' : '0',
        skipTrial,
        quantity: String(Math.min(15, Math.max(1, pendingQuantity))),
      });

      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(`/api/stripe/create-checkout?${params}`, {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
      }).finally(() => clearTimeout(abortTimer));

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.url) {
        const msg = isStripeValidationErrorCode(json.error)
          ? tStripeErr(stripeValidationErrorToApiStripeKey(json.error))
          : typeof json.error === 'string' && json.error.trim()
            ? json.error
            : tStripeErr('generic');
        toast.error(msg);
        setPayPhase('proceed');
        return;
      }

      setStep('redirecting');
      window.location.replace(json.url as string);
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      toast.error(isAbort ? t('toastStripeTimeout') : t('toastStripeNetwork'));
      setPayPhase('proceed');
    }
  }, [
    locale,
    pendingPlanSlug,
    pendingAnnual,
    pendingSignupMode,
    pendingQuantity,
    acceptedZenith,
    t,
    tStripeErr,
  ]);

  const isZenith = pendingPlanSlug === 'zenith';
  const consentReady = acceptedCgu && (!isZenith || acceptedZenith);
  const isPaying = payPhase !== 'proceed';
  const payButtonLabel =
    payPhase === 'saving' ? t('payLabelSaving') : payPhase === 'stripe' ? t('payLabelStripe') : t('payLabelProceed');

  // ── OTP loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return <BrandLoadingOverlay active />;
  }

  // ── Redirect Stripe ─────────────────────────────────────────────────────────
  if (step === 'redirecting') {
    return <BrandLoadingOverlay active />;
  }

  // ── GDPR / consent step ─────────────────────────────────────────────────────
  if (step === 'consent') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
        <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2 text-white" aria-label={t('brandWordmark')}>
            <Logo />
            <span className="font-display font-bold text-lg tracking-heading text-white uppercase">
              {t('brandWordmark')}
            </span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
          <div className="w-full max-w-md rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-8 sm:p-10 shadow-2xl shadow-black/20">

            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-emerald-50 p-4">
                <ShieldCheck className="w-12 h-12 text-emerald-600" aria-hidden />
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-center">
              {t('consentTitle')}
            </h1>
            <p className="text-slate-500 mt-2 text-center text-sm leading-relaxed">{t('consentSubtitle')}</p>

            {pendingPlanSlug && (
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 uppercase tracking-wide">
                  {t('planChipPlan', { plan: pendingPlanSlug })}
                  {pendingAnnual ? t('planChipAnnual') : t('planChipMonthly')}
                </span>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('legalSectionTitle')}
              </p>

              {/* Terms — all plans */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedCgu}
                  onChange={(e) => setAcceptedCgu(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#2563eb] cursor-pointer"
                />
                <span className="text-sm leading-relaxed text-slate-600 group-hover:text-slate-800 transition-colors">
                  {legalAcceptCheckboxRich}
                </span>
              </label>

              {/* Zenith GDPR clause — Zenith plan only */}
              {isZenith && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={acceptedZenith}
                    onChange={(e) => setAcceptedZenith(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#2563eb] cursor-pointer"
                  />
                  <span className="text-sm leading-relaxed text-slate-600 group-hover:text-slate-800 transition-colors">
                    {tPricing('zenithDataConsent')}
                  </span>
                </label>
              )}
            </div>

            {!consentReady && (
              <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {!acceptedCgu ? t('consentHintCgu') : t('consentHintZenith')}
              </p>
            )}

            <div className="mt-5 rounded-xl border border-[#2563eb]/15 bg-[#2563eb]/5 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 mb-2">{t('passkeyTitle')}</p>
              <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">{t('passkeyBody')}</p>
              <PasskeyEnrollButton variant="secondary" className="w-full justify-center text-sm" />
            </div>

            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={!consentReady || isPaying}
              className="mt-6 w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isPaying && <Loader2 className="w-4 h-4 animate-spin" />}
              {payButtonLabel}
            </button>

            <p className="text-center mt-4 text-xs text-slate-400">{t('stripeFooterNote')}</p>
          </div>
        </main>

        <footer className="py-4 text-center">
          <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            {t('linkBackHome')}
          </Link>
        </footer>
      </div>
    );
  }

  // ── OTP form ─────────────────────────────────────────────────────────────────
  const isCodeComplete = normalizeOtpCode(code).length === 6;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label={t('brandWordmark')}>
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white uppercase">
            {t('brandWordmark')}
          </span>
        </Link>
        <Link href="/login" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          {t('headerLogin')}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-8 sm:p-10 shadow-2xl shadow-black/20">

          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-[#2563eb]/10 p-4">
              <KeyRound className="w-12 h-12 text-[#2563eb]" aria-hidden />
            </div>
          </div>

          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-center">
            {t('otpTitle')}
          </h1>
          <p className="text-slate-600 mt-3 text-center text-sm">{t('otpSubtitle')}</p>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label htmlFor="confirm-email-input" className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('labelEmail')}
              </label>
              <input
                id="confirm-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">{t('labelOtpCode')}</label>
              <OtpInput
                value={code}
                onChange={handleCodeChange}
                disabled={false}
                autoFocus
                id="otp-verify"
              />
            </div>

            <button
              type="submit"
              disabled={!isCodeComplete || !email.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {t('submitActivate')}
            </button>
          </form>

          <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 px-4 py-3 mt-6 text-sm text-slate-700">
            <p className="mb-2">{t('resendHint')}</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0 || !email.trim()}
              className="text-[#2563eb] font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0
                ? t('resendCountdown', { seconds: resendCooldown })
                : resendLoading
                  ? t('resendSending')
                  : t('resendCta')}
            </button>
          </div>

          <p className="text-center mt-6">
            <Link href="/login" className="text-sm text-[#2563eb] hover:underline font-medium">
              {t('linkBackLogin')}
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-4 text-center">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors">
          {t('linkBackHome')}
        </Link>
      </footer>
    </div>
  );

  function handleResend() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    setResendLoading(true);
    fetch('/api/auth/resend-signup-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, locale }),
    })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (r.status === 429) {
          toast.error(t('toastResendRateLimit'));
          return;
        }
        if (!r.ok) {
          toast.error(j.error ?? t('toastResendFailed'));
          return;
        }
        toast.success(t('toastResendSuccess'));
        setResendCooldown(60);
        const iv = setInterval(() => {
          setResendCooldown((p) => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; });
        }, 1000);
      })
      .catch(() => toast.error(t('toastResendNetwork')))
      .finally(() => setResendLoading(false));
  }
}
