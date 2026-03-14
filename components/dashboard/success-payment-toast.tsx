'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

const PLAN_DISPLAY: Record<string, string> = {
  vision: 'Vision',
  pulse: 'Pulse',
  zenith: 'ZENITH',
};

export function SuccessPaymentToast() {
  const searchParams = useSearchParams();
  const shownRef = useRef(false);

  useEffect(() => {
    const status = searchParams?.get('status');
    const plan = searchParams?.get('plan');
    if ((status !== 'success' && status !== 'trial_started') || shownRef.current) return;

    shownRef.current = true;
    const planName = plan && PLAN_DISPLAY[plan] ? PLAN_DISPLAY[plan] : plan ?? 'Premium';
    const message = status === 'trial_started'
      ? `Félicitations ! Votre essai ${planName} est activé. Profitez de 14 jours gratuits !`
      : `Félicitations ! Votre plan ${planName} est maintenant actif.`;
    toast.success(message, {
      duration: 5000,
    });
  }, [searchParams]);

  return null;
}
