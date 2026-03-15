'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useMounted } from '@/lib/use-mounted';

function fireConfettiCannon() {
  void import('canvas-confetti').then((mod) => {
    const confetti = mod.default;
    const duration = 2500;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 45, spread: 100, zIndex: 9999 };

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#2563eb', '#1e40af', '#ffffff', '#0f172a', '#fbbf24'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#2563eb', '#1e40af', '#ffffff', '#0f172a', '#fbbf24'],
      });
    }, 250);
    return () => clearInterval(interval);
  }).catch(() => {});
}

export function SuccessOverlay() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useMounted();
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    const status = searchParams?.get('status');
    if ((status !== 'success' && status !== 'trial_started') || doneRef.current)
      return;

    doneRef.current = true;
    setShow(true);
    fireConfettiCannon();

    const DURATION = 3000;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(p);
      if (p < 100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const t = setTimeout(() => {
      setShow(false);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('status');
      params.delete('plan');
      params.delete('session_id');
      const query = params.toString();
      const cleanUrl = pathname + (query ? `?${query}` : '');
      router.replace(cleanUrl, { scroll: false });
    }, DURATION);
    return () => clearTimeout(t);
  }, [mounted, searchParams, router, pathname]);

  if (!mounted || !show) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-md"
      aria-live="polite"
      aria-label="Bienvenue REPUTEXA"
    >
      <div className="mx-4 flex max-w-md flex-col items-center gap-6 rounded-2xl border border-[#2563eb]/30 bg-white dark:bg-zinc-900 p-8 shadow-2xl shadow-black/30">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563eb]/10 dark:bg-[#2563eb]/20 text-3xl">
          🚀
        </div>
        <h2 className="text-center text-xl font-bold text-slate-900 dark:text-zinc-100">
          Bienvenue dans l&apos;aventure REPUTEXA ! 🚀
        </h2>
        <p className="text-center text-sm text-slate-600 dark:text-zinc-400">
          Configuration de votre intelligence artificielle...
        </p>
        <div className="w-full space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-[#2563eb] transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
