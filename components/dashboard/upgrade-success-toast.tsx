'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { SUBSCRIPTION_QUERY_KEY } from '@/lib/use-subscription';

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

/** Une seule célébration par visite : même si le composant re-render, on ne rejoue pas. */
const hasShownRef = { current: false };

function fireConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default;
    const duration = 2000;
    const end = Date.now() + duration;
    const interval = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 3,
        startVelocity: 30,
        spread: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ['#2563eb', '#1e40af', '#ffffff', '#fbbf24'],
      });
    }, 150);
  }).catch(() => {});
}

/** Rafraîchissement forcé : session Supabase + données serveur pour afficher nouveau plan et limites sans F5. */
async function forceRefreshSessionAndData(router: { refresh: () => void }) {
  const supabase = createClient();
  await supabase.auth.refreshSession();
  await supabase.auth.getUser();
  router.refresh();
}

/** Retour après upgrade (status=upgraded) : confettis + toast une seule fois, URL nettoyée immédiatement. */
export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    const status = searchParams?.get('status');
    if (status !== 'upgraded') return;
    if (hasShownRef.current) return;

    hasShownRef.current = true;

    const plan = searchParams?.get('plan');
    const planName = plan ? (PLAN_DISPLAY[plan] ?? plan) : 'votre plan supérieur';

    queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    fireConfetti();
    toast.success(`Félicitations ! Votre passage au plan ${planName} est validé. 🚀`, {
      duration: 6000,
      className: 'border-[#2563eb]/30 shadow-lg',
    });

    if (searchParams?.get('showUpdates') === 'true') {
      window.dispatchEvent(new CustomEvent('dashboard-show-updates-modal'));
    }
    router.replace(pathname, { scroll: false });

    void forceRefreshSessionAndData(router).then(() => {});
    const t1 = setTimeout(() => router.refresh(), 500);
    const t2 = setTimeout(() => router.refresh(), 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [searchParams, router, pathname, queryClient]);

  return null;
}
