'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { OtpInput } from '@/components/auth/otp-input';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { consumeSignupPending } from '@/lib/auth/signup-pending';
import { motion } from 'framer-motion';

function normalizeOtpCode(raw: string): string {
  return String(raw)
    .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, '')
    .replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 6);
}

/**
 * Page de vérification email — OTP 6 chiffres.
 * Une seule requête. Verrou requestSent. Pas d'effets sur le code ou la session.
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

  const requestSent = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery).trim().toLowerCase());
    }
  }, [emailFromQuery]);

  const handleCodeChange = useCallback(
    (v: string) => {
      setCode(v);
      if (normalizeOtpCode(v).length === 6 && !requestSent.current) {
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
        console.log('REQUÊTE ENVOYÉE');
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

        if (stripeUrl && typeof stripeUrl === 'string' && stripeUrl.startsWith('http')) {
          window.location.assign(stripeUrl);
          return;
        }
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

  const handleResend = useCallback(async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    setResendLoading(true);
    try {
      const res = await fetch('/api/auth/resend-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast.error('Sécurité activée : Patientez 60 secondes.');
        setResendLoading(false);
        return;
      }
      if (!res.ok) {
        toast.error(json.error ?? 'Impossible de renvoyer.');
        setResendLoading(false);
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
    } catch {
      toast.error('Erreur réseau.');
    } finally {
      setResendLoading(false);
    }
  }, [email]);

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

  const isCodeComplete = normalizeOtpCode(code).length === 6;

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
}
