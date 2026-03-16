'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { PasswordField } from '@/components/auth/password-field';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordPage() {
  const router = useRouter();
  const locale = useLocale();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalidSession, setInvalidSession] = useState(false);

  const passwordsMatch = password === passwordConfirm && passwordConfirm.length > 0;
  const passwordsMismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

  const checkSession = useCallback(async () => {
    const supabase = createClient();
    for (let i = 0; i < 3; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
        return;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 300));
    }
    const hasRecoveryHash = typeof window !== 'undefined' && window.location.hash?.includes('type=recovery');
    if (!hasRecoveryHash) setInvalidSession(true);
    else setReady(true);
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }
    if (password !== passwordConfirm) {
      toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? 'Erreur lors de la réinitialisation.');
      return;
    }
    toast.success('Mot de passe mis à jour. Vous pouvez vous connecter.');
    router.replace(`/${locale}/login?message=password-reset`);
  }

  if (!ready && !invalidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (invalidSession) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-950/80">
        <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg tracking-heading text-white uppercase">REPUTEXA</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="max-w-md w-full rounded-[24px] border border-[#2563eb]/20 bg-white/95 backdrop-blur-sm p-8 text-center">
            <h1 className="font-display text-xl font-bold text-slate-900">Lien expiré ou invalide</h1>
            <p className="text-slate-500 mt-2">
              Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demandez un nouveau lien.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block mt-6 py-2.5 px-5 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110"
            >
              Nouvelle demande
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
                Nouveau mot de passe
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Choisissez un mot de passe sécurisé.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mot de passe <span className="text-red-500">*</span>
                </label>
                <PasswordField
                  id="reset-password"
                  value={password}
                  onChange={setPassword}
                  showPassword={showPassword}
                  onToggleVisibility={() => setShowPassword((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                />
                <p className="text-xs text-slate-400 mt-1">Minimum 6 caractères</p>
              </div>
              <div>
                <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirmer le mot de passe <span className="text-red-500">*</span>
                </label>
                <PasswordField
                  id="reset-password-confirm"
                  value={passwordConfirm}
                  onChange={setPasswordConfirm}
                  showPassword={showPasswordConfirm}
                  onToggleVisibility={() => setShowPasswordConfirm((v) => !v)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  error={passwordsMismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}
                />
              </div>
              <button
                type="submit"
                disabled={!passwordsMatch || loading || password.length < MIN_PASSWORD_LENGTH}
                className="w-full py-3 rounded-xl font-semibold text-white bg-[#2563eb] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Mettre à jour mon mot de passe'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-slate-500 mt-5">
              <Link href="/login" className="text-[#2563eb] hover:brightness-110 font-medium">
                ← Retour à la connexion
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
