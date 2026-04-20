'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { consumeSignupPending } from '@/lib/auth/signup-pending';
import { purgeClientCachesForNewAccount } from '@/lib/auth/client-storage-cleanup';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { toast } from 'sonner';
import { Fingerprint, Loader2, Mail } from 'lucide-react';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('LoginPage');
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const confirmMessage = searchParams?.get('message') === 'confirm-email';
  const grandCentralBindMessage = searchParams?.get('message') === 'grand-central-bind';
  const passwordlessRecoveryMessage = searchParams?.get('message') === 'passwordless-recovery';
  const authCallbackFailed = searchParams?.get('error') === 'auth-callback-failed';

  const emailFromQuery = searchParams?.get('email') ?? '';

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery).trim().toLowerCase());
    }
  }, [emailFromQuery]);

  useEffect(() => {
    const pending = consumeSignupPending();
    const password = pending?.password;
    if (!pending || !password) return;
    (async () => {
      purgeClientCachesForNewAccount();
      const supabase = createClient();
      await supabase.auth.signOut({ scope: 'local' });
      const { error } = await supabase.auth.signInWithPassword({
        email: pending.email,
        password,
      });
      if (!error) {
        const nextRaw = searchParams?.get('next');
        const target = nextRaw?.startsWith('/') ? nextRaw : `/${locale}/dashboard`;
        window.location.replace(target);
      }
    })();
  }, [locale, searchParams]);

  const sendMagicLink = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error(t('toastEmailRequired'));
      return;
    }
    if (!EMAIL_OK.test(trimmed)) {
      toast.error(t('toastEmailInvalid'));
      return;
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(t('toastTurnstileWait'));
      return;
    }
    setLoginError(null);
    setMagicLoading(true);
    const signInEmail = trimmed;
    const nextRaw = searchParams?.get('next');
    const next = nextRaw ? decodeURIComponent(nextRaw) : '';
    const path = next?.startsWith('/') ? next : `/${locale}/dashboard`;

    try {
      const magicRes = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInEmail,
          locale,
          next: path,
          turnstileToken: turnstileToken ?? '',
        }),
      });
      const magicJson = await magicRes.json().catch(() => ({}));
      if (magicRes.status === 429) {
        toast.error(
          typeof magicJson.error === 'string' ? magicJson.error : t('toastRateLimit')
        );
        return;
      }
      if (!magicRes.ok) {
        const msg =
          typeof magicJson.error === 'string'
            ? magicJson.error
            : t('toastErrorStatus', { status: magicRes.status });
        setLoginError(msg);
        toast.error(msg);
        return;
      }
      setMagicSent(true);
      toast.success(t('toastMagicSent'), {
        duration: 8000,
      });
    } catch {
      toast.error(t('toastNetworkError'));
    } finally {
      setMagicLoading(false);
    }
  }, [email, turnstileToken, locale, searchParams, t]);

  return (
    <div className="min-h-screen flex flex-col hero-dashboard-bg">
      <header className="flex items-center justify-end px-4 sm:px-6 h-14 border-b border-white/5 shrink-0">
        <Link href="/signup?mode=trial" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          {t('navSignup')}
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-[24px] border border-[#2563eb]/25 bg-white/95 backdrop-blur-sm p-7 sm:p-9 shadow-2xl shadow-black/25">
            <div className="flex flex-col items-center text-center mb-8">
              <Link href="/" className="mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 rounded-2xl" aria-label={t('ariaBrand')}>
                <Logo size="xl" priority />
              </Link>
              <p className="font-display text-xs font-semibold tracking-[0.2em] text-primary uppercase mb-2">REPUTEXA</p>
              <h1 className="font-display text-2xl sm:text-[1.65rem] font-bold text-slate-900 tracking-tight">{t('title')}</h1>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">{t('subtitle')}</p>
            </div>

            <div className="mb-5 rounded-xl border border-[#2563eb]/15 bg-[#2563eb]/5 px-4 py-3 flex gap-3 text-left">
              <Fingerprint className="w-5 h-5 text-[#2563eb] shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-slate-700 leading-relaxed">{t('securityBlurb')}</p>
            </div>

            <div className="space-y-4">
              {grandCentralBindMessage && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
                  {t('grandCentralBanner')}
                </div>
              )}
              {confirmMessage && (
                <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 backdrop-blur-sm px-4 py-3 text-sm text-slate-700">
                  {t('confirmEmailBanner')}
                </div>
              )}
              {passwordlessRecoveryMessage && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                  {t('passwordlessRecoveryBanner')}
                </div>
              )}
              {authCallbackFailed && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  {t('authCallbackFailedBanner')}
                </div>
              )}
              {loginError && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  {loginError}
                </div>
              )}
              {magicSent && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
                  {t('magicSentBanner')}
                </div>
              )}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t('emailLabel')} <span className="text-red-500">{t('emailRequiredStar')}</span>
                </label>
                <input
                  ref={emailRef}
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200"
                  placeholder={t('emailPlaceholder')}
                />
              </div>
              <AuthTurnstile
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                action="login"
              />
              <button
                type="button"
                onClick={() => void sendMagicLink()}
                disabled={magicLoading}
                className="w-full py-3 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {magicLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('submitLoading')}
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    {t('submitCta')}
                  </>
                )}
              </button>
              <p className="text-xs text-slate-500 text-center">{t('footerHint')}</p>
            </div>

            <p className="text-center text-sm text-slate-500 mt-5">
              {t('signupPrompt')}{' '}
              <Link href="/signup?mode=trial" className="text-primary hover:brightness-110 font-medium">
                {t('signupLink')}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-5 text-center shrink-0">
        <Link
          href="/"
          className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1"
        >
          ← {t('backHome')}
        </Link>
      </footer>
    </div>
  );
}
