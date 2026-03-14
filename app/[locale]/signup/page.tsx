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
          <span className="font-display font-bold text-lg tracking-heading text-white">REPUTEXA</span>
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
                  Vous avez choisi le plan <strong>{planDisplayName}</strong> — Finalisez votre inscription pour passer au paiement.
                </p>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mt-1">
                    Accès ZENITH 14 jours — 0€ aujourd&apos;hui, carte requise
                  </p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/50">
                    14 jours gratuits sur le plan ZENITH. Carte bancaire requise pour valider l&apos;accès. Annulation en un clic depuis votre espace client.
                  </p>
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
