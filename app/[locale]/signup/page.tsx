'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { PasswordField } from '@/components/auth/password-field';
import { AuthTurnstile } from '@/components/auth/turnstile';
import { signupSchema, type SignupInput } from '@/lib/auth/schemas';
import { storeSignupPending } from '@/lib/auth/signup-pending';
import { getAuthErrorMessage } from '@/lib/auth/errors';
import { toast } from 'sonner';
import { Loader2, MapPin } from 'lucide-react';
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
const PLAN_TO_METADATA: Record<string, 'vision' | 'pulse' | 'zenith'> = {
  vision: 'vision',
  pulse: 'pulse',
  zenith: 'zenith',
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
  const annualParam = searchParams?.get('annual') === '1';
  const isTrial = modeParam === 'trial';
  const isCheckout = modeParam === 'checkout';
  const plan = planParam && VALID_PLANS.includes(planParam as (typeof VALID_PLANS)[number])
    ? (planParam as (typeof VALID_PLANS)[number])
    : 'zenith';
  const planDisplayName = PLAN_DISPLAY[plan] ?? 'Zenith';

  const [fullName, setFullName] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentType, setEstablishmentType] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    fullNameRef.current?.focus();
  }, []);

  const passwordsMatch = password === passwordConfirm && passwordConfirm.length > 0;
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    const supabase = createClient();
    const redirectTo = `${getSiteUrl()}/${locale}/auth/callback?next=${encodeURIComponent('/dashboard')}`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    setGoogleLoading(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim() && !isValidPhoneNumber(phone)) {
      toast.error('Numéro de téléphone invalide.');
      return;
    }
    const parsed = signupSchema.safeParse({
      fullName,
      establishmentName,
      establishmentType,
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
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error('Vérification de sécurité en cours. Réessayez dans un instant.');
      return;
    }
    setLoading(true);
    try {
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: turnstileToken ?? '', action: 'signup' }),
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
    if (data.phone) {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: data.phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error(json.error ?? 'Trop de tentatives. Veuillez patienter une minute.');
        setLoading(false);
        return;
      }
      if (json.available === false) {
        toast.error('Ce numéro de téléphone est déjà associé à un compte.');
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
        password: data.password,
        fullName: data.fullName,
        establishmentName: data.establishmentName,
        establishmentType: data.establishmentType,
        address: data.address || undefined,
        phone: data.phone || undefined,
        subscriptionPlan,
        selectedPlan,
        signupMode: isTrial ? 'trial' : 'checkout',
        annual: isCheckout ? annualParam : undefined,
        locale,
      }),
    });

    const signupJson = await signupRes.json().catch(() => ({}));
    setLoading(false);

    if (signupRes.status === 429) {
      toast.error(signupJson.error ?? 'Trop de tentatives. Veuillez patienter une minute.');
      return;
    }
    if (!signupRes.ok) {
      toast.error(signupJson.error ?? getAuthErrorMessage({ message: signupJson.error }));
      return;
    }

    toast.success('Compte créé ! Entrez le code reçu par email pour activer votre compte.');
    const normalizedEmail = data.email.trim().toLowerCase();
    storeSignupPending({ email: normalizedEmail, password: data.password });
    setTimeout(() => {
      window.location.href = `/${locale}/verify?email=${encodeURIComponent(normalizedEmail)}`;
    }, 1200);
  }

  const canSubmit =
    fullName.trim() &&
    establishmentName.trim() &&
    establishmentType.trim() &&
    email.trim() &&
    password.length >= 6 &&
    passwordsMatch &&
    !passwordsMismatch &&
    !loading;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading text-white uppercase">REPUTEXA</span>
        </Link>
        <Link href="/login" className="text-sm text-white/70 hover:text-white font-medium transition-colors">
          Connexion
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
                Créer mon compte
              </h1>
              {isCheckout ? (
                <p className="text-sm text-slate-500 mt-1">
                  Vous avez choisi le plan <strong>{planDisplayName}</strong>
                  {annualParam ? ' (facturation annuelle -20%)' : ' (facturation mensuelle)'} — Finalisez votre inscription pour passer au paiement.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mt-1">
                    Essai gratuit ZENITH — 0€ aujourd&apos;hui, carte requise
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                    Essai gratuit sur le plan ZENITH. Carte bancaire requise pour valider l&apos;accès. Annulation en un clic depuis votre espace client.
                  </p>
                  <div className="mt-6 w-full flex flex-col items-center gap-3">
                    <p className="text-xs text-slate-400">
                      Propulsé par les meilleures plateformes&nbsp;:
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-6">
                      <div className="h-6 sm:h-7 flex items-center grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                        <svg viewBox="0 0 24 24" aria-hidden className="h-full w-auto">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      </div>
                      <div className="h-6 sm:h-7 flex items-center grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                        <svg viewBox="0 0 24 24" aria-hidden className="h-full w-auto">
                          <path
                            fill="#1877F2"
                            d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24h11.495v-9.294H9.691V11.01h3.129V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.794.143v3.24h-1.918c-1.504 0-1.796.715-1.796 1.763v2.313h3.59l-.467 3.696h-3.123V24h6.116C23.407 24 24 23.407 24 22.676V1.325C24 .593 23.407 0 22.675 0z"
                          />
                        </svg>
                      </div>
                      <div className="h-6 sm:h-7 flex items-center grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                        <svg viewBox="0 0 24 24" aria-hidden className="h-full w-auto">
                          <path
                            fill="#00B67A"
                            d="M21.852 9.246H14.86L12 2.25l-2.86 6.996H2.148L8.04 13.11 5.18 20.25 12 16.139l6.82 4.111L15.96 13.11l5.892-3.864z"
                          />
                          <path
                            fill="#005128"
                            d="M17.021 15.22 15.96 13.11 12 15.6z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200"
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200"
                  placeholder="La Frite d'Or"
                />
              </div>

              <div>
                <label htmlFor="signup-establishment-type" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Type d&apos;établissement <span className="text-red-500">*</span>
                </label>
                <input
                  id="signup-establishment-type"
                  type="text"
                  value={establishmentType}
                  onChange={(e) => setEstablishmentType(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200"
                  placeholder="Hôtel, restaurant, bar, salon de coiffure..."
                />
                <p className="mt-1 text-xs text-slate-400">
                  Indiquez le type d&apos;activité (ex&nbsp;: hôtel, restaurant, bar, cabinet médical...). Vous pouvez préciser librement.
                </p>
              </div>

              <div>
                <label htmlFor="signup-address" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Adresse
                </label>
                <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-within:ring-2 focus-within:ring-[#2563eb]/30 focus-within:border-primary transition-all duration-200">
                  <MapPin className="shrink-0 w-4 h-4 text-slate-400" aria-hidden />
                  <input
                    id="signup-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Saisissez votre adresse..."
                    autoComplete="street-address"
                    className="flex-1 min-w-0 bg-transparent focus:outline-none placeholder:text-slate-400"
                  />
                </div>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-primary transition-all duration-200"
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
                    Création en cours...
                  </>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-primary hover:brightness-110 font-medium">
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
