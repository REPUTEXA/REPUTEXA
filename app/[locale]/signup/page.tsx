'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { getSiteUrl } from '@/lib/site-url';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { PasswordField } from '@/components/auth/password-field';
import { signupSchema, type SignupInput } from '@/lib/auth/schemas';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';

function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!password.length) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (score <= 2) return { level: 1, label: 'Faible', color: 'bg-red-500' };
  if (score <= 4) return { level: 2, label: 'Moyen', color: 'bg-amber-500' };
  return { level: 3, label: 'Fort', color: 'bg-emerald-500' };
}

const VALID_PLANS = ['vision', 'pulse', 'zenith'] as const;
const PLAN_TO_METADATA: Record<string, 'starter' | 'manager' | 'Dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'Dominator',
};
const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'Zenith',
};

export default function SignupPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const fullNameRef = useRef<HTMLInputElement>(null);

  const modeParam = searchParams?.get('mode') ?? 'trial';
  const planParam = searchParams?.get('plan');
  const isTrial = modeParam === 'trial';
  const isCheckout = modeParam === 'checkout';
  const plan = planParam && VALID_PLANS.includes(planParam as (typeof VALID_PLANS)[number])
    ? (planParam as (typeof VALID_PLANS)[number])
    : 'zenith';
  const planDisplayName = PLAN_DISPLAY[plan] ?? 'Zenith';

  const [fullName, setFullName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    fullNameRef.current?.focus();
  }, []);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const supabase = createClient();
    const nextRaw = searchParams?.get('next');
    const next = nextRaw ? decodeURIComponent(nextRaw) : '';
    const path = next?.startsWith('/') ? next : '/dashboard';
    const redirectTo = `${getSiteUrl()}/${locale}${path}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    setGoogleLoading(false);
  }

  const passwordsMatch = password === passwordConfirm && passwordConfirm.length > 0;
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }
    const parsed = signupSchema.safeParse({
      fullName,
      establishmentName,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email,
      password,
      passwordConfirm,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Vérifiez les champs.';
      toast.error(msg);
      return;
    }
    const data = parsed.data as SignupInput;
    setLoading(true);
    const supabase = createClient();
    const subscriptionPlan = isTrial ? 'Dominator' : (PLAN_TO_METADATA[plan] ?? 'manager');
    const selectedPlan = isTrial ? 'zenith' : plan;

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          business_name: data.establishmentName,
          establishment_name: data.establishmentName,
          address: data.address || undefined,
          phone: data.phone || undefined,
          subscription_plan: subscriptionPlan,
          selected_plan: selectedPlan,
          signup_mode: isTrial ? 'trial' : 'checkout',
        },
      },
    });

    setLoading(false);
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[signup] Supabase auth error:', error.message, error);
      }
      toast.error(getAuthErrorMessage(error));
      return;
    }

    if (authData.user && !authData.session) {
      toast.success('Compte créé ! Vérifiez votre boîte mail pour activer votre compte.');
      setTimeout(() => {
        window.location.href = `/${locale}/login?message=confirm-email`;
      }, 1200);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      toast.error('La session n\'a pas pu être créée. Réessayez ou contactez le support.');
      return;
    }

    // Synchroniser les infos d'inscription vers le profil (paramètres)
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        establishmentName: data.establishmentName,
        address: data.address || undefined,
        phone: data.phone || undefined,
      }),
    }).catch(() => {});

    toast.success(`Bienvenue ${data.fullName} ! 🎉 Vous êtes connecté.`);
    if (isTrial) {
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          establishmentName: data.establishmentName,
          fullName: data.fullName,
          locale,
          type: 'trial',
        }),
      }).catch(() => {});
    }

    if (isTrial) {
      setTimeout(() => {
        window.location.href = `/${locale}/dashboard`;
      }, 800);
    } else {
      setTimeout(() => {
        window.location.href = `/${locale}/checkout?plan=${plan}`;
      }, 800);
    }
  }

  const canSubmit =
    fullName.trim() &&
    establishmentName.trim() &&
    email.trim() &&
    password.length >= 6 &&
    passwordsMatch &&
    !passwordsMismatch &&
    !loading;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-blue-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white">REPUTEXA</span>
        </Link>
        <Link href="/login" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          Connexion
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md animate-fade-up">
          <div className="rounded-[24px] border border-white/10 bg-white p-6 sm:p-8 shadow-2xl shadow-black/20">
            <div className="flex flex-col items-center text-center mb-6">
              <Link href="/" className="mb-4" aria-label="REPUTEXA">
                <Logo size="lg" />
              </Link>
              <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
                Créer mon compte
              </h1>
              {isCheckout ? (
                <p className="text-sm text-slate-500 mt-1">
                  Vous avez choisi le plan <strong>{planDisplayName}</strong> — Finalisez votre inscription pour passer au paiement.
                </p>
              ) : (
                <p className="text-sm text-slate-500 mt-1">
                  Accès ZENITH 14 jours — 100% gratuit, sans carte bancaire
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="signup-fullname" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Prénom / Nom <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fullNameRef}
                  id="signup-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label htmlFor="signup-establishment" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nom de l&apos;établissement <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-establishment"
                  type="text"
                  value={establishmentName}
                  onChange={(e) => setEstablishmentName(e.target.value)}
                  required
                  autoComplete="organization"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  placeholder="La Frite d'Or"
                />
              </div>

              <div>
                <label htmlFor="signup-address" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Adresse
                </label>
                <input
                  id="signup-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  placeholder="12 rue de la Paix, 75001 Paris"
                />
              </div>

              <div>
                <label htmlFor="signup-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Téléphone
                </label>
                <PhoneInput
                  id="signup-phone"
                  value={phone}
                  onChange={(v) => setPhone(v ?? '')}
                  placeholder="6 12 34 56 78"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200"
                  placeholder="vous@etablissement.com"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <PasswordField
                  id="signup-password"
                  value={password}
                  onChange={setPassword}
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          strength.level >= 1 ? (strength.level === 1 ? 'bg-red-500 w-1/3' : strength.level === 2 ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full') : 'w-0'
                        }`}
                      />
                    </div>
                    <p
                      className={`text-xs font-medium mt-1 ${
                        strength.level === 1 ? 'text-red-600' : strength.level === 2 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {strength.label}
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Minimum 6 caractères</p>
              </div>

              <div>
                <label htmlFor="signup-password-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmation du mot de passe <span className="text-red-500">*</span>
                </label>
                <PasswordField
                  id="signup-password-confirm"
                  value={passwordConfirm}
                  onChange={setPasswordConfirm}
                  showPassword={showPasswordConfirm}
                  onToggleVisibility={() => setShowPasswordConfirm((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  error={passwordsMismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  'Créer mon compte'
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
                className="w-full py-3 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:opacity-50 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
              >
                {googleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                Continuer avec Google
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Se connecter
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
