'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

function fireConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default;
    const duration = 2000;
    const end = Date.now() + duration;
    const colors = ['#2563eb', '#1e40af', '#fbbf24', '#ffffff', '#f59e0b'];
    const interval = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 4,
        startVelocity: 45,
        spread: 100,
        origin: { x: Math.random(), y: 0.6 },
        colors,
        zIndex: 9999,
      });
    }, 120);
  }).catch(() => {});
}

type Props = {
  firstLogin: boolean;
  planDisplayName: string;
  /** Plan Zenith : propose le téléchargement de l’affiche caisse depuis Collecte d’avis. */
  suggestCounterPoster?: boolean;
};

/** Évite de spammer l’API si `first_login` reste true alors que la célébration a déjà eu lieu (localStorage). */
const welcomeStaleRecoveryAttempted = new Set<string>();

/**
 * Première connexion : confettis + toast bienvenue (une fois par compte dans ce navigateur).
 * Si l’URL a status=success | trial_started, SuccessPaymentToast gère la célébration.
 * Après succès : sessionStorage + refresh serveur pour que `first_login` ne boucle pas.
 */
export function WelcomeFlash({ firstLogin, planDisplayName, suggestCounterPoster }: Props) {
  const firedRef = useRef(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('Dashboard.welcomeFlash');
  const status = searchParams?.get('status');
  const isReturnFromCheckout = status === 'success' || status === 'trial_started';

  useEffect(() => {
    if (!firstLogin) return;

    let cancelled = false;

    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user?.id || cancelled) return;

      const storageKey = `reputexa_welcome_done_${user.id}`;
      const already =
        typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1';

      if (already) {
        if (!welcomeStaleRecoveryAttempted.has(user.id)) {
          welcomeStaleRecoveryAttempted.add(user.id);
          const res = await fetch('/api/profile/update-first-login', { method: 'POST' }).catch(() => null);
          if (res?.ok) router.refresh();
          else welcomeStaleRecoveryAttempted.delete(user.id);
        }
        return;
      }

      if (firedRef.current) return;
      firedRef.current = true;

      if (isReturnFromCheckout) {
        return;
      }

      fireConfetti();
      const planName = planDisplayName?.trim() || t('planFallback');
      toast.success(t('welcomeToast', { planName }), {
        duration: suggestCounterPoster ? 8500 : 5000,
        className: 'border-[#2563eb]/30 shadow-lg',
        description: suggestCounterPoster ? t('posterActionDescription') : undefined,
        action: suggestCounterPoster
          ? {
              label: t('posterActionLabel'),
              onClick: () => router.push('/dashboard/whatsapp-review?tab=collecte'),
            }
          : undefined,
      });

      const res = await fetch('/api/profile/update-first-login', { method: 'POST' }).catch(() => null);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey, '1');
      }
      if (res?.ok) router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    firstLogin,
    planDisplayName,
    isReturnFromCheckout,
    suggestCounterPoster,
    router,
    t,
  ]);

  return null;
}
