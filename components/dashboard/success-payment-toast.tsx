'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SUBSCRIPTION_QUERY_KEY } from '@/lib/use-subscription';
import { clearCheckoutIntent } from '@/lib/checkout-intent';

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

function fireConfetti() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default;
    const duration = 2000;
    const end = Date.now() + duration;
    const colors = ['#2563eb', '#1e40af', '#fbbf24', '#ffffff'];
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

/** Une seule célébration : ref pour éviter tout doublon même si re-render. */
const hasShownRef = { current: false };

/** Retour d'un paiement réussi (status=success) : confettis + toast bienvenue une seule fois, puis URL nettoyée. */
export function SuccessPaymentToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const status = searchParams?.get('status');
    const plan = searchParams?.get('plan');
    if (status !== 'success' && status !== 'trial_started') return;

    if (hasShownRef.current) return;
    hasShownRef.current = true;

    const planName = plan ? (PLAN_DISPLAY[plan] ?? plan) : 'votre plan';
    clearCheckoutIntent();
    queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    fireConfetti();
    toast.success(`Bienvenue dans le plan ${planName} ! 🎉`, {
      duration: 5000,
      className: 'border-[#2563eb]/30 shadow-lg',
    });
    fetch('/api/profile/update-first-login', { method: 'POST' }).catch(() => {});

    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router, queryClient]);

  return null;
}
