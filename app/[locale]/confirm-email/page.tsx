'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { OtpInput } from '@/components/auth/otp-input';
import { KeyRound, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { consumeSignupPending } from '@/lib/auth/signup-pending';
import { motion } from 'framer-motion';

type Step = 'verify' | 'consent' | 'redirecting';

function normalizeOtpCode(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * Page de vérification email — OTP 6 chiffres.
 * Après validation, insert une étape de consentement RGPD avant la redirection Stripe.
 */
export default function ConfirmEmailPage() {
  const locale = useLocale();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams?.get('email') ?? '';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Étape de consentement RGPD
  const [step, setStep] = useState<Step>('verify');
  const [pendingStripeUrl, setPendingStripeUrl] = useState('');
  const [pendingPlanSlug, setPendingPlanSlug] = useState('');
  const [acceptedCgu, setAcceptedCgu] = useState(false);
  const [acceptedZenith, setAcceptedZenith] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  const requestSent = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Pré-remplir l'email depuis l'URL
  useEffect(() => {
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery).trim().toLowerCase());
    }
  }, [emailFromQuery]);

  // Auto-remplir depuis ?code= et auto-soumettre dès que l'email est prêt
  useEffect(() => {
    const codeFromUrl = normalizeOtpCode(searchParams?.get('code') ?? '');
    if (codeFromUrl.length !== 6) return;

    setCode(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dès que code + email sont tous les deux prêts (cas lien email), déclencher auto-submit
  useEffect(() => {
    const codeFromUrl = normalizeOtpCode(searchParams?.get('code') ?? '');
    if (codeFromUrl.length !== 6) return;     // pas venu du lien email
    if (!email) return;                        // attendre que l'email soit dans le state
    if (requestSent.current) return;

    const timer = setTimeout(() => {
      if (!requestSent.current) {
        formRef.current?.requestSubmit();
      }
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]); // re-run quand l'email arrive

  const handleCodeChange = useCallback(
    (v: string) => {
      setCode(v);
      if (normalizeOtpCode(v).length === 6 && !requestSent.current) {
        // Afficher le spinner immédiatement pour retour visuel instantané
        setIsLoading(true);
        formRef.current?.requestSubmit();
      }
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (requestSent.current) return;

      const trimmedEmail = email.trim().toLowerCase();
      const trimmedCode = normalizeOtpCode(code);
      if (!trimmedEmail || trimmedCode.length !== 6) return;

      requestSent.current = true;
      setIsLoading(true);

      try {
        const res = await fetch('/api/auth/verify-signup-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: trimmedEmail,
            code: trimmedCode,
            locale,
          }),
        });
        const json = await res.json().catch(() => ({}));

        if (res.status === 401 || res.status === 429) {
          toast.error(json.error ?? 'Trop de tentatives. Patientez.');
          setTimeout(() => {
            requestSent.current = false;
            setIsLoading(false);
          }, 5000);
          return;
        }

        if (!res.ok) {
          requestSent.current = false;
          setIsLoading(false);
          toast.error(json.error ?? 'Vérification échouée.');
          return;
        }

        // Authentifier l'utilisateur côté client
        const pending = consumeSignupPending(trimmedEmail);
        if (pending?.password) {
          const supabase = createClient();
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: pending.password,
          });
        } else {
          const supabase = createClient();
          await supabase.auth.refreshSession();
        }

        const stripeUrl = json.stripeUrl as string | undefined;
        const redirectTo = json.redirectTo as string | undefined;
        const planSlug = typeof json.planSlug === 'string' ? json.planSlug : '';

        // Si Stripe → étape de consentement RGPD avant paiement
        if (stripeUrl && typeof stripeUrl === 'string' && stripeUrl.startsWith('http')) {
          setPendingStripeUrl(stripeUrl);
          setPendingPlanSlug(planSlug);
          setIsLoading(false);
          requestSent.current = false;
          setStep('consent');
          return;
        }

        // Redirection non-Stripe (ex: dashboard pour essai déjà actif)
        if (redirectTo?.startsWith('/')) {
          window.location.assign(`/${locale}${redirectTo}`);
          return;
        }

        requestSent.current = false;
        setIsLoading(false);
        toast.error(json.error ?? 'Une erreur est survenue.');
      } catch {
        requestSent.current = false;
        setIsLoading(false);
        toast.error('Erreur réseau. Réessayez.');
      }
    },
    [email, code, locale]
  );

  const handleProceedToPayment = useCallback(async () => {
    setIsSavingConsent(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const updates: Record<string, boolean> = { accepted_terms: true };
        if (pendingPlanSlug === 'zenith') {
          updates.accepted_zenith_terms = true;
        }
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        if (error) {
          console.warn('[confirm-email] profile update terms:', error.message);
        }
      }
    } catch (err) {
      console.warn('[confirm-email] terms update failed:', err);
    }
    setStep('redirecting');
    window.location.assign(pendingStripeUrl);
  }, [pendingStripeUrl, pendingPlanSlug]);

  const isZenith = pendingPlanSlug === 'zenith';
  const consentReady = acceptedCgu && (!isZenith || acceptedZenith);

  // Écran de chargement pendant vérification OTP
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <Logo size="lg" />
        </motion.div>
        <p className="mt-6 text-zinc-500 text-sm">Vérification finale...</p>
      </div>
    );
  }

  // Écran de chargement pendant redirection Stripe
  if (step === 'redirecting') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <Logo size="lg" />
        </motion.div>
        <p className="mt-6 text-zinc-500 text-sm">Redirection vers le paiement...</p>
      </div>
    );
  }

  // ── Écran de consentement RGPD ──────────────────────────────────────────────
  if (step === 'consent') {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
        <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg tracking-heading text-white uppercase">REPUTEXA</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
          <div className="w-full max-w-md rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-8 sm:p-10 shadow-2xl shadow-black/20">

            {/* Icône + titre */}
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-emerald-50 p-4">
                <ShieldCheck className="w-12 h-12 text-emerald-600" aria-hidden />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-center">
              Dernière étape avant le paiement
            </h1>
            <p className="text-slate-500 mt-2 text-center text-sm leading-relaxed">
              Votre email est confirmé. Validez les éléments suivants pour accéder au paiement sécurisé.
            </p>

            {/* Badge plan sélectionné */}
            {pendingPlanSlug && (
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 uppercase tracking-wide">
                  Plan {pendingPlanSlug}
                </span>
              </div>
            )}

            {/* Bloc consentements */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Validation légale requise
              </p>

              {/* Checkbox 1 — tous les plans */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  id="consent-cgu"
                  type="checkbox"
                  checked={acceptedCgu}
                  onChange={(e) => setAcceptedCgu(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#2563eb] cursor-pointer"
                />
                <span className="text-sm leading-relaxed text-slate-600 group-hover:text-slate-800 transition-colors">
                  J&apos;accepte les{' '}
                  <a
                    href={`/${locale}/legal/cgu`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563eb] underline underline-offset-2 hover:text-[#1d4ed8] transition-colors"
                  >
                    CGU
                  </a>
                  {' '}et la{' '}
                  <a
                    href={`/${locale}/legal/confidentialite`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2563eb] underline underline-offset-2 hover:text-[#1d4ed8] transition-colors"
                  >
                    Politique de Confidentialité
                  </a>
                  {' '}de Reputexa.
                </span>
              </label>

              {/* Checkbox 2 — Plan Zenith uniquement */}
              {isZenith && (
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    id="consent-zenith"
                    type="checkbox"
                    checked={acceptedZenith}
                    onChange={(e) => setAcceptedZenith(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#2563eb] cursor-pointer"
                  />
                  <span className="text-sm leading-relaxed text-slate-600 group-hover:text-slate-800 transition-colors">
                    Je confirme avoir informé mes clients de la transmission de leurs données à Reputexa pour la sollicitation d&apos;avis, conformément au RGPD.
                  </span>
                </label>
              )}
            </div>

            {/* Message d'aide si cases non cochées */}
            {!consentReady && (
              <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {!acceptedCgu
                  ? 'Cochez la case CGU pour continuer.'
                  : 'Cochez la confirmation RGPD Zenith pour continuer.'}
              </p>
            )}

            {/* Bouton de validation */}
            <button
              type="button"
              onClick={handleProceedToPayment}
              disabled={!consentReady || isSavingConsent}
              className="mt-6 w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isSavingConsent ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              {isSavingConsent ? 'Enregistrement...' : 'Procéder au paiement →'}
            </button>

            <p className="text-center mt-4 text-xs text-slate-400">
              Paiement sécurisé via Stripe. Aucune donnée bancaire n&apos;est stockée par Reputexa.
            </p>
          </div>
        </main>

        <footer className="py-4 text-center">
          <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex gap-1">
            ← Retour à l&apos;accueil
          </Link>
        </footer>
      </div>
    );
  }

  // ── Formulaire OTP (étape initiale) ────────────────────────────────────────
  const isCodeComplete = normalizeOtpCode(code).length === 6;

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
        <div className="w-full max-w-md rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-8 sm:p-10 shadow-2xl shadow-black/20">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-[#2563eb]/10 p-4">
              <KeyRound className="w-12 h-12 text-[#2563eb]" aria-hidden />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight text-center">
            Entrez votre code de vérification
          </h1>
          <p className="text-slate-600 mt-3 text-center text-sm">
            Nous vous avons envoyé un code à 6 chiffres par email.
          </p>

          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label htmlFor="confirm-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="confirm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="vous@exemple.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Code à 6 chiffres
              </label>
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
              className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
            >
              Activer mon compte
            </button>
          </form>

          <div className="rounded-xl bg-[#2563eb]/5 border border-[#2563eb]/20 px-4 py-3 mt-6 text-sm text-slate-700">
            <p className="mb-2">Pas reçu ? Vérifiez vos spams.</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0 || !email.trim()}
              className="text-[#2563eb] font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : resendLoading ? 'Envoi...' : 'Renvoyer un code'}
            </button>
          </div>

          <p className="text-center mt-6">
            <Link href="/login" className="text-sm text-[#2563eb] hover:underline font-medium">
              Retour à la connexion
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-4 text-center">
        <Link href="/" className="text-sm text-white/50 hover:text-white/80 transition-colors inline-flex gap-1">
          ← Retour à l&apos;accueil
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
      body: JSON.stringify({ email: trimmedEmail }),
    })
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (res.status === 429) {
          toast.error('Sécurité activée : Patientez 60 secondes.');
          return;
        }
        if (!res.ok) {
          toast.error(json.error ?? 'Impossible de renvoyer.');
          return;
        }
        toast.success('Un nouveau code a été envoyé.');
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      })
      .catch(() => toast.error('Erreur réseau.'))
      .finally(() => setResendLoading(false));
  }
}
