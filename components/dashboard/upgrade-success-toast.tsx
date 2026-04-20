'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { SUBSCRIPTION_QUERY_KEY } from '@/lib/use-subscription';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('Dashboard.upgradeSuccessToast');
  const refreshTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const status = searchParams?.get('status');
    if (status !== 'upgraded') return;

    let cancelled = false;
    refreshTimersRef.current.forEach(clearTimeout);
    refreshTimersRef.current = [];

    const plan = searchParams?.get('plan') ?? '';
    const showUpdates = searchParams?.get('showUpdates') === 'true';

    void (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user?.id || cancelled) return;

      const dedupeKey = `reputexa_dashboard_celebration_${user.id}_upgraded_${plan}`;
      if (typeof localStorage !== 'undefined' && localStorage.getItem(dedupeKey) === '1') {
        router.replace(pathname, { scroll: false });
        return;
      }

      const planName = plan ? (PLAN_DISPLAY[plan] ?? plan) : t('planFallback');

      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
      fireConfetti();
      toast.success(t('message', { planName }), {
        duration: 6000,
        className: 'border-[#2563eb]/30 shadow-lg',
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(dedupeKey, '1');
      }

      if (showUpdates) {
        window.dispatchEvent(new CustomEvent('dashboard-show-updates-modal'));
      }
      router.replace(pathname, { scroll: false });

      void forceRefreshSessionAndData(router).then(() => {});
      refreshTimersRef.current.push(
        setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 500),
        setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 1500),
      );
    })();

    return () => {
      cancelled = true;
      refreshTimersRef.current.forEach(clearTimeout);
      refreshTimersRef.current = [];
    };
  }, [searchParams, router, pathname, queryClient, t]);

  return null;
}
