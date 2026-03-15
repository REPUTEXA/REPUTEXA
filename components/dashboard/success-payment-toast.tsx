'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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

/** Retour d'un paiement réussi : confettis immédiats + toast bienvenue + invalidation abo pour afficher tout de suite le bon intervalle (€/an ou €/mois). */
export function SuccessPaymentToast() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shownRef = useRef(false);

  useEffect(() => {
    const status = searchParams?.get('status');
    const plan = searchParams?.get('plan');
    if ((status !== 'success' && status !== 'trial_started') || shownRef.current) return;

    shownRef.current = true;
    clearCheckoutIntent();
    queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    fireConfetti();
    const planName = plan ? (PLAN_DISPLAY[plan] ?? plan) : 'Vision';
    toast.success(`Bienvenue ! Votre plan ${planName} est activé. 🎉`, {
      duration: 5000,
      className: 'border-[#2563eb]/30 shadow-lg',
    });
  }, [searchParams]);

  return null;
}
