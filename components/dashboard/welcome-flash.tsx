'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

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
};

/** Première connexion : confettis + toast bienvenue. Ne pas afficher le toast si l'URL a status=success ou trial_started (SuccessPaymentToast s'en charge, évite le doublon). */
export function WelcomeFlash({ firstLogin, planDisplayName }: Props) {
  const firedRef = useRef(false);
  const searchParams = useSearchParams();
  const status = searchParams?.get('status');
  const isReturnFromCheckout = status === 'success' || status === 'trial_started';

  useEffect(() => {
    if (!firstLogin || firedRef.current) return;
    firedRef.current = true;
    if (!isReturnFromCheckout) {
      fireConfetti();
      const planName = planDisplayName?.trim() || 'Vision';
      toast.success(`Bienvenue ! Votre plan ${planName} est activé. 🎉`, {
        duration: 5000,
        className: 'border-[#2563eb]/30 shadow-lg',
      });
      fetch('/api/profile/update-first-login', { method: 'POST' }).catch(() => {});
    }
  }, [firstLogin, planDisplayName, isReturnFromCheckout]);

  return null;
}
