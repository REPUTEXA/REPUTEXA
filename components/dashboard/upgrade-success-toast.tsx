'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter, usePathname } from '@/i18n/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

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
  await supabase.auth.getUser(); // Force la mise à jour de la session locale côté client
  router.refresh(); // Revalide Server Components et données du Dashboard (limites, plan, etc.)
}

export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const status = searchParams?.get('status');
    if (status !== 'upgraded' || shownRef.current) return;

    shownRef.current = true;
    fireConfetti();
    toast.success('Félicitations ! Votre abonnement a été mis à jour avec succès. Profitez de vos nouveaux avantages ! 🚀', {
      duration: 6000,
      className: 'border-[#2563eb]/30 shadow-lg',
    });
    void forceRefreshSessionAndData(router).then(() => {
      // Données et session à jour : l'utilisateur voit immédiatement ses nouvelles limites (ex. sites ZENITH).
    });
    const t1 = setTimeout(() => router.refresh(), 500);
    const t2 = setTimeout(() => router.refresh(), 1500);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('status');
    const qs = params.toString();
    const cleanUrl = pathname + (qs ? `?${qs}` : '');
    const t3 = setTimeout(() => router.replace(cleanUrl, { scroll: false }), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isMounted, searchParams, router, pathname]);

  return null;
}
