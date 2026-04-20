'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
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

/** Retour d'un paiement réussi (status=success) : confettis + toast bienvenue une seule fois, puis URL nettoyée. */
export function SuccessPaymentToast() {
  const t = useTranslations('Dashboard.successPaymentToast');
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const status = searchParams?.get('status');
    const plan = searchParams?.get('plan');
    if (status !== 'success' && status !== 'trial_started') return;

    let cancelled = false;

    void (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user?.id || cancelled) return;

      const dedupeKey = `reputexa_dashboard_celebration_${user.id}_checkout_${status}_${plan ?? ''}`;
      if (typeof localStorage !== 'undefined' && localStorage.getItem(dedupeKey) === '1') {
        router.replace(pathname, { scroll: false });
        return;
      }

      const planName = plan ? (PLAN_DISPLAY[plan] ?? plan) : t('planFallback');
      clearCheckoutIntent();
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      fireConfetti();
      toast.success(t('welcome', { planName }), {
        duration: 5000,
        className: 'border-[#2563eb]/30 shadow-lg',
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(dedupeKey, '1');
      }

      fetch('/api/profile/update-first-login', { method: 'POST' }).catch(() => {});

      router.replace(pathname, { scroll: false });
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, pathname, router, queryClient, t]);

  return null;
}
