'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { signupSchema, type SignupInput } from '@/lib/auth/schemas';
import { storeSignupPending, clearSignupPendingStorage } from '@/lib/auth/signup-pending';
import { purgeClientCachesForNewAccount } from '@/lib/auth/client-storage-cleanup';
import { createClient } from '@/lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
import { Fingerprint, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import type { Country } from 'react-phone-number-input';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { SignupCountryCombobox } from '@/components/signup-country-combobox';
import { getCountryDisplayName, getRegionCodeForSiteLocale } from '@/lib/i18n/locale-region';
import { getSignupUi } from '@/lib/i18n/signup-ui-by-locale';

const VALID_PLANS = ['vision', 'pulse', 'zenith'] as const;
const PLAN_TO_METADATA: Record<string, 'vision' | 'pulse' | 'zenith'> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
};
/** Hoisted pour ESLint (i18next/no-literal-string en JSX). */
const SIGNUP_COUNTRY_HINT_ID = 'signup-country-hint';
const PHONE_INPUT_SURFACE_LIGHT = 'light';

export default function SignupPage() {
  const locale = useLocale();
  const tBilling = useTranslations('Billing');
  const u = getSignupUi(locale);
  const searchParams = useSearchParams();
  const fullNameRef = useRef<HTMLInputElement>(null);

  const modeParam = searchParams?.get('mode') ?? 'trial';
  const planParam = searchParams?.get('plan');
  const annualParam = searchParams?.get('annual') === '1';
  const checkoutQuantity = Math.min(
    15,
    Math.max(1, parseInt(searchParams?.get('quantity') ?? '1', 10) || 1)
  );
  const isTrial = modeParam === 'trial';
  const isCheckout = modeParam === 'checkout';
  const plan = planParam && VALID_PLANS.includes(planParam as (typeof VALID_PLANS)[number])
    ? (planParam as (typeof VALID_PLANS)[number])
    : 'zenith';
  const planDisplayName =
    plan === 'vision'
      ? tBilling('plans.vision')
      : plan === 'pulse'
        ? tBilling('plans.pulse')
        : tBilling('plans.zenith');

  const [fullName, setFullName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentType, setEstablishmentType] = useState('');
  const [address, setAddress] = useState('');
  const defaultCountryCode = useMemo(() => getRegionCodeForSiteLocale(locale), [locale]);
  const [countryCodeOverride, setCountryCodeOverride] = useState<string | null>(null);
  const countryCode = countryCodeOverride ?? defaultCountryCode;
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    fullNameRef.current?.focus();
  }, []);

  useEffect(() => {
    setCountryCodeOverride(null);
  }, [locale]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error(u.toastInvalidPhone);
      return;
    }
    const countryLabel = getCountryDisplayName(locale, countryCode);
    const parsed = signupSchema.safeParse({
      fullName,
      establishmentName,
      establishmentType,
      city: '',
      postal_code: '',
      country: countryLabel,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? u.toastCheckFields;
      toast.error(msg);
      return;
    }
    const data = parsed.data as SignupInput;
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(u.toastTurnstileWait);
      return;
    }
    setLoading(true);
    try {
      // Déconnexion silencieuse si un autre compte était connecté
      clearSignupPendingStorage();
      purgeClientCachesForNewAccount();
      const supabase = createClient();
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: turnstileToken ?? '', action: 'signup' }),
      });
      if (verifyRes.status === 429) {
        const json = await verifyRes.json().catch(() => ({}));
        toast.error(json.error ?? u.toastRateLimit);
        setLoading(false);
        return;
      }
      if (!verifyRes.ok) {
        const json = await verifyRes.json().catch(() => ({}));
        toast.error(json.error ?? u.toastVerifyFailed);
        setLoading(false);
        return;
      }
    } catch {
      toast.error(u.toastNetwork);
      setLoading(false);
      return;
    }
    if (data.phone) {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error(json.error ?? u.toastRateLimit);
        setLoading(false);
        return;
      }
      if (json.available === false) {
        toast.error(u.toastPhoneTaken);
        setLoading(false);
        return;
      }
    }

    const subscriptionPlan = isTrial ? 'zenith' : (PLAN_TO_METADATA[plan] ?? 'pulse');
    const selectedPlan = isTrial ? 'zenith' : plan;

    const signupRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        fullName: data.fullName,
        establishmentName: data.establishmentName,
        establishmentType: data.establishmentType,
        city: data.city,
        postal_code: data.postal_code,
        country: data.country,
        address: data.address || undefined,
        phone: data.phone || undefined,
        subscriptionPlan,
        selectedPlan,
        signupMode: isTrial ? 'trial' : 'checkout',
        annual: isCheckout ? annualParam : undefined,
        quantity: isCheckout ? checkoutQuantity : undefined,
        locale,
      }),
    });

    const signupJson = await signupRes.json().catch(() => ({}));
    setLoading(false);

    if (signupRes.status === 429) {
      toast.error(signupJson.error ?? u.toastRateLimit);
      return;
    }
    if (!signupRes.ok) {
      toast.error(signupJson.error ?? getAuthErrorMessage({ message: signupJson.error }));
      return;
    }

    toast.success(u.toastCreated, { duration: 6000 });
    const normalizedEmail = data.email.trim().toLowerCase();
    storeSignupPending({ email: normalizedEmail });
    setTimeout(() => {
      window.location.href = `/${locale}/verify?email=${encodeURIComponent(normalizedEmail)}`;
    }, 1200);
  }

  const canSubmit =
    fullName.trim() &&
    establishmentName.trim() &&
    establishmentType.trim() &&
    email.trim() &&
    !loading;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white uppercase">REPUTEXA</span>
        </Link>
        <Link href="/login" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          {u.login}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/20 text-slate-900 [color-scheme:light]">
            <div className="flex flex-col items-center text-center mb-6">
              <Link href="/" className="mb-4" aria-label="REPUTEXA">
                <Logo size="lg" />
              </Link>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">{u.title}</h1>
              {isCheckout ? (
                <p className="text-sm text-slate-500 mt-1">
                  {u.checkoutSubtitle} <strong>{planDisplayName}</strong>
                  {annualParam ? ` ${u.checkoutSubtitleAnnual}` : ` ${u.checkoutSubtitleMonthly}`}{' '}
                  {u.checkoutEnd}
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mt-1">{u.trialLine}</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                    {u.trialBox}
                  </p>
                </>
              )}
            </div>

            <div className="mb-5 rounded-xl border border-emerald-200/80 bg-emerald-50/90 dark:bg-emerald-950/30 dark:border-emerald-800/50 px-4 py-3 flex gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" aria-hidden />
                  {u.securityTitle}
                </p>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-200/80 mt-1 leading-relaxed">
                  {u.securityBody}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="off">
              <div>
                <label htmlFor="signup-fullname" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelFullName} <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fullNameRef}
                  id="signup-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 dark:bg-white"
                  placeholder={u.placeholderFullName}
                />
              </div>

              <div>
                <label htmlFor="signup-establishment" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelEstablishment} <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-establishment"
                  type="text"
                  value={establishmentName}
                  onChange={(e) => setEstablishmentName(e.target.value)}
                  required
                  autoComplete="off"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 dark:bg-white"
                  placeholder={u.placeholderEstablishment}
                />
              </div>

              <div>
                <label htmlFor="signup-establishment-type" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelEstablishmentType} <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-establishment-type"
                  type="text"
                  value={establishmentType}
                  onChange={(e) => setEstablishmentType(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 dark:bg-white"
                  placeholder={u.placeholderEstablishmentType}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{u.hintEstablishmentType}</p>
              </div>

              <div>
                <label htmlFor="signup-address" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelAddress}
                </label>
                <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-within:ring-2 focus-within:ring-[#2563eb]/30 focus-within:border-primary transition-all duration-200 dark:bg-white">
                  <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
                  <input
                    id="signup-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={u.placeholderAddress}
                    autoComplete="off"
                    className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-country" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelCountry}
                </label>
                <SignupCountryCombobox
                  id="signup-country"
                  locale={locale}
                  value={countryCode}
                  onChange={(code) => setCountryCodeOverride(code)}
                  describedById={SIGNUP_COUNTRY_HINT_ID}
                />
                <p id={SIGNUP_COUNTRY_HINT_ID} className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                  {u.hintCountry}
                </p>
              </div>

              <div>
                <label htmlFor="signup-phone" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelPhone}
                </label>
                <PhoneInput
                  id="signup-phone"
                  value={phone}
                  onChange={(v) => setPhone(v ?? '')}
                  placeholder={u.placeholderPhone}
                  surface={PHONE_INPUT_SURFACE_LIGHT}
                  defaultCountry={countryCode as Country}
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 dark:text-slate-700 mb-1.5">
                  {u.labelEmail} <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200 dark:bg-white"
                  placeholder={u.placeholderEmail}
                />
              </div>

              <AuthTurnstile
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                action="signup"
              />

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {u.submitLoading}
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    {u.submitIdle}
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              {u.footerLoginPrompt}{' '}
              <Link href="/login" className="text-primary hover:brightness-110 font-medium">
                {u.footerLoginCta}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1">
          {u.footerHome}
        </Link>
      </footer>
    </div>
  );
}
