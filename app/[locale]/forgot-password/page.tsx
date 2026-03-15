'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const t = useTranslations('Auth');
  const tFp = useTranslations('Auth.ForgotPassword');
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error(tFp('enterEmail'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      toast.error(t('invalidEmail'));
      return;
    }
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(t('captchaVerifying'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, locale, turnstileToken: turnstileToken ?? '' }),
      });
      const json = await res.json().catch(() => ({}));
      setSent(true);
      const errorKey = typeof json.error === 'string' ? json.error : '';
      const knownKeys = ['rateLimit', 'captchaRequired', 'captchaVerifying', 'genericError'];
      const translatedError = knownKeys.includes(errorKey) ? t(errorKey as 'rateLimit' | 'captchaRequired' | 'captchaVerifying' | 'genericError') : errorKey;
      if (res.status === 429) {
        toast.error(translatedError || t('rateLimit'));
      } else if (!res.ok) {
        const err = errorKey?.toLowerCase() ?? '';
        const isNotFound = err.includes('user not found') || err.includes('email not found') || err.includes('with this email');
        if (!isNotFound) {
          toast.error(translatedError || t('genericError'));
        }
      } else if (json.sent === false && json.reason) {
        const { createClient } = await import('@/lib/supabase/client');
        const { getSiteUrl } = await import('@/lib/site-url');
        const supabase = createClient();
        const rawBaseUrl = getSiteUrl();
        const baseUrl = rawBaseUrl.replace(/\/+$/, '');
        const resetUrl = `${baseUrl}/${locale}/auth/callback?next=/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo: resetUrl });
        const errMsg = error?.message?.toLowerCase() ?? '';
        const isNotFound = errMsg.includes('user not found') || errMsg.includes('email not found') || errMsg.includes('with this email');
        if (error && !isNotFound) {
          toast.error(error.message ?? t('genericError'));
        }
      }
    } catch {
      toast.error(t('networkError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white">REPUTEXA</span>
        </Link>
        <Link
          href="/login"
          className="text-sm text-white/70 hover:text-white font-medium transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('login')}
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/20">
            <div className="flex flex-col items-center text-center mb-6">
              <Link href="/" className="mb-4" aria-label="REPUTEXA">
                <Logo size="lg" />
              </Link>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                {tFp('title')}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {tFp('subtitle')}
              </p>
            </div>

            {sent ? (
              <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 backdrop-blur-sm px-4 py-4 text-center">
                <p className="text-sm text-slate-700">
                  <strong className="text-[#2563eb]">{tFp('successTitle')}</strong> {tFp('successMessage')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <AuthTurnstile
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                  action="forgot-password"
                />
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    {tFp('emailLabel')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={emailRef}
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all duration-200"
                    placeholder={tFp('placeholder')}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {tFp('sending')}
                    </>
                  ) : (
                    tFp('submit')
                  )}
                </button>
              </form>
            )}

            <p className="text-center text-sm text-slate-500 mt-5">
              <Link href="/login" className="text-[#2563eb] hover:brightness-110 font-medium">
                ← {tFp('backToLogin')}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1">
          ← {tFp('backHome')}
        </Link>
      </footer>
    </div>
  );
}
