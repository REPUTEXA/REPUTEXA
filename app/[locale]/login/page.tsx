'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { consumeSignupPending } from '@/lib/auth/signup-pending';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { PasswordField } from '@/components/auth/password-field';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { loginSchema } from '@/lib/auth/schemas';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const confirmMessage = searchParams?.get('message') === 'confirm-email';
  const passwordResetMessage = searchParams?.get('message') === 'password-reset';
  const authCallbackFailed = searchParams?.get('error') === 'auth-callback-failed';

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  useEffect(() => {
    if (authCallbackFailed) {
      toast.error('Le lien de confirmation a expiré ou est invalide. Connectez-vous avec votre email et mot de passe.');
    }
  }, [authCallbackFailed]);

  useEffect(() => {
    const pending = consumeSignupPending();
    if (!pending) return;
    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: pending.email, password: pending.password });
      if (!error) {
        const nextRaw = searchParams?.get('next');
        const target = nextRaw?.startsWith('/') ? nextRaw : `/${locale}/dashboard`;
        router.replace(target);
      }
    })();
  }, [locale, router, searchParams]);

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    const nextRaw = searchParams?.get('next');
    const next = nextRaw ? decodeURIComponent(nextRaw) : '/dashboard';
    const path = next.startsWith('/') ? next : '/dashboard';
    const redirectTo = `${getSiteUrl()}/${locale}/auth/callback?next=${encodeURIComponent(path)}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    setGoogleLoading(false);
  }, [locale, searchParams]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Vérifiez les champs.');
      return;
    }
    const { email: signInEmail, password: signInPassword } = parsed.data;
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error('Vérification de sécurité en cours. Réessayez dans un instant.');
      return;
    }
    setLoginError(null);
    setLoading(true);
    try {
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: turnstileToken ?? '', action: 'login' }),
      });
      if (verifyRes.status === 429) {
        const json = await verifyRes.json().catch(() => ({}));
        toast.error(json.error ?? 'Trop de tentatives. Veuillez patienter une minute.');
        setLoading(false);
        return;
      }
      if (!verifyRes.ok) {
        const json = await verifyRes.json().catch(() => ({}));
        toast.error(json.error ?? 'Vérification échouée. Réessayez.');
        setLoading(false);
        return;
      }
    } catch {
      toast.error('Erreur réseau. Réessayez.');
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });
    setLoading(false);
    if (error) {
      const friendlyMsg = getAuthErrorMessage(error);
      setLoginError(friendlyMsg);
      return;
    }
    const nextRaw = searchParams?.get('next');
    const next = nextRaw ? decodeURIComponent(nextRaw) : '';
    const target = next?.startsWith('/') ? next : `/${locale}/dashboard`;
    router.replace(target);
  }, [email, password, turnstileToken, locale, searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white uppercase">REPUTEXA</span>
        </Link>
        <Link href="/signup?mode=trial" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          Inscription
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
                Connexion
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Accédez à votre dashboard e-réputation
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {confirmMessage && (
                <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 backdrop-blur-sm px-4 py-3 text-sm text-slate-700">
                  <strong className="text-[#2563eb]">Vérifiez votre boîte mail</strong> et cliquez sur le lien pour activer votre compte, puis connectez-vous.
                </div>
              )}
              {passwordResetMessage && (
                <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 backdrop-blur-sm px-4 py-3 text-sm text-slate-700">
                  <strong className="text-[#2563eb]">Votre mot de passe a été réinitialisé.</strong> Connectez-vous avec votre nouveau mot de passe.
                </div>
              )}
              {authCallbackFailed && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  <strong>Lien expiré ou invalide.</strong> Connectez-vous avec votre email et mot de passe.
                </div>
              )}
              {loginError && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  {loginError}
                </div>
              )}
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
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
                  placeholder="vous@etablissement.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
                    Mot de passe <span className="text-red-500">*</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-[#2563eb] hover:brightness-110 font-medium"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <PasswordField
                  id="login-password"
                  value={password}
                  onChange={setPassword}
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <AuthTurnstile
                onVerify={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                action="login"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-white bg-primary hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>

              <div className="relative flex items-center gap-3 my-4">
                <span className="flex-1 h-px bg-slate-200" />
                <span className="text-xs font-medium text-slate-500">ou</span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                Continuer avec Google
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Pas encore de compte ?{' '}
              <Link href="/signup?mode=trial" className="text-primary hover:brightness-110 font-medium">
                S&apos;inscrire
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex items-center gap-1">
          ← Retour à l&apos;accueil
        </Link>
      </footer>
    </div>
  );
}
