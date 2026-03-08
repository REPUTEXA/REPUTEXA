'use client';

import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { Loader2, CreditCard, Shield } from 'lucide-react';

const PLAN_TYPES = ['vision', 'pulse', 'zenith', 'starter', 'manager', 'dominator'] as const;
type PlanType = (typeof PLAN_TYPES)[number];

/** Plan affiché (URL) → plan Stripe/API (legacy) */
const PLAN_TO_STRIPE: Record<string, 'starter' | 'manager' | 'dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'dominator',
  starter: 'starter',
  manager: 'manager',
  dominator: 'dominator',
};

function isValidPlan(plan: string | null): plan is PlanType {
  return plan !== null && PLAN_TYPES.includes(plan as PlanType);
}

export default function CheckoutPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planParam = searchParams.get('plan');
  const hasValidPlan = planParam && ['vision', 'pulse', 'zenith'].includes(planParam);
  const plan: PlanType = isValidPlan(planParam) ? planParam : 'pulse';
  const stripePlan = PLAN_TO_STRIPE[plan] ?? 'manager';
  const skipTrial = searchParams.get('trial') === '0';

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        locale,
        planType: stripePlan,
        planSlug: plan,
      });
      if (skipTrial) params.set('skipTrial', '1');
      const res = await fetch(
        `/api/stripe/create-checkout?${params}`,
        { method: 'POST', credentials: 'include' }
      );
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

  if (!hasValidPlan) {
    router.replace(`/${locale}/choose-plan`);
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo size="sm" />
          <span className="text-xl font-bold">REPUTEXA</span>
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h1 className="text-2xl font-bold text-white">
            {skipTrial ? 'Finalisez votre abonnement' : 'Complétez votre essai gratuit'}
          </h1>
          <p className="mt-2 text-zinc-400">
            {skipTrial
              ? "Paiement immédiat — Accès immédiat à votre dashboard."
              : "14 jours d'essai gratuit. Aucun débit aujourd'hui."}
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
              <CreditCard className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-zinc-300">
                {skipTrial
                  ? 'Paiement sécurisé par carte bancaire'
                  : 'Carte bancaire requise — 0€ débités aujourd\'hui'}
              </span>
            </div>
            {!skipTrial && (
              <div className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3">
                <Shield className="h-5 w-5 text-emerald-400" />
                <span className="text-sm text-zinc-300">
                  14 jours d&apos;essai — Annulez à tout moment
                </span>
              </div>
            )}
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
            ) : skipTrial ? (
              'Payer et accéder au dashboard'
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
