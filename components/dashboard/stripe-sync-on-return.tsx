'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Appelé quand l'utilisateur revient de Stripe avec ?session_id=xxx.
 * Met à jour selected_plan dans Supabase pour que le cadenas disparaisse sans déconnexion.
 */
export function StripeSyncOnReturn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const syncedRef = useRef(false);

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (!sessionId || syncedRef.current) return;

    syncedRef.current = true;

    fetch('/api/stripe/sync-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
      credentials: 'include',
    })
      .then((res) => res.json())
      .then(() => {
        router.refresh();
        setTimeout(() => router.refresh(), 500);
      })
      .catch(() => {});
  }, [searchParams, router]);

  return null;
}
