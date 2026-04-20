'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker (hors dev) et prépare l’API Push (permission + clé publique VAPID).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'development') return;

    const base = window.location.origin;
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: '/' })
      .then((reg) => {
        if (!reg.pushManager || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) return;
          if (Notification.permission === 'denied') return;
        });
      })
      .catch(() => {});

    return () => {};
  }, []);

  return null;
}
