'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';

function fireConfetti() {
  void import('canvas-confetti')
    .then((mod) => {
      const confetti = mod.default;
      const count = 200;
      const defaults = { origin: { y: 0.7 }, zIndex: 9999 };
      const fire = (particleRatio: number, opts: { spread?: number; startVelocity?: number; decay?: number; scalar?: number }) => {
        confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
      };
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    })
    .catch(() => {});
}

export function SubscriptionSuccessEffects() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [showInitModal, setShowInitModal] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const status = searchParams?.get('status');
    if ((status !== 'success' && status !== 'trial_started') || doneRef.current) return;

    doneRef.current = true;
    setShowInitModal(true);
    fireConfetti();

    const t = setTimeout(() => {
      setShowInitModal(false);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('status');
      params.delete('plan');
      params.delete('session_id');
      const query = params.toString();
      const cleanUrl = pathname + (query ? `?${query}` : '');
      router.replace(cleanUrl, { scroll: false });
    }, 3000);
    return () => clearTimeout(t);
  }, [isMounted, searchParams, router, pathname]);

  if (!isMounted || !showInitModal) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      aria-live="polite"
      aria-label="Paiement validé"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 bg-white dark:bg-zinc-900 p-8 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-2xl">
          ✓
        </div>
        <p className="text-center text-lg font-semibold text-slate-900 dark:text-zinc-100">
          Paiement validé. Bienvenue chez Reputation AI 🚀
        </p>
      </div>
    </div>
  );
}
