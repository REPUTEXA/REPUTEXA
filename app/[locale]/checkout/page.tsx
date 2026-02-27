'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Link } from '@/i18n/navigation';
import { Loader2, CreditCard, Shield } from 'lucide-react';

export default function CheckoutPage() {
  const locale = useLocale();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/stripe/checkout?locale=${locale}`, {
        method: 'POST',
        credentials: 'include',
      });
      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        const text = await res.text();
        console.error('[checkout] Réponse non-JSON:', res.status, text.slice(0, 200));
        throw new Error(`Erreur serveur (${res.status}). Vérifiez les logs Vercel.`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isSignedIn) {
    router.replace(`/${locale}/sign-in?redirect_url=/${locale}/checkout`);
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="text-xl font-bold text-white">
          RepuAI
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-2xl font-bold text-white">
            Complétez votre essai gratuit
          </h1>
          <p className="mt-2 text-zinc-400">
            14 jours d&apos;essai gratuit. Aucun débit aujourd&apos;hui.
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-zinc-300">
                Carte bancaire requise — 0€ débités aujourd&apos;hui
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span className="text-sm text-zinc-300">
                14 jours d&apos;essai — Annulez à tout moment
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/20 p-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="shiny-button mt-8 w-full rounded-lg bg-blue-500 py-4 font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirection vers Stripe...
              </span>
            ) : (
              'Commencer l\'essai gratuit — Ajouter ma carte'
            )}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Paiement sécurisé par Stripe. Vos données sont protégées.
          </p>
        </div>
      </main>
    </div>
  );
}
