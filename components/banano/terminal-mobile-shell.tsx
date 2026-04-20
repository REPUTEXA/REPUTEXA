'use client';

import { useEffect } from 'react';

type Props = {
  children: React.ReactNode;
};

/**
 * Route `/terminal` : limite le pull-to-refresh du navigateur et garde l’écran allumé (Wake Lock).
 */
export function TerminalMobileShell({ children }: Props) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOsy = html.style.overscrollBehaviorY;
    const prevBodyOsy = body.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'contain';
    body.style.overscrollBehaviorY = 'contain';

    let sentinel: WakeLockSentinel | null = null;

    async function acquireWakeLock() {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      try {
        if (sentinel) {
          await sentinel.release().catch(() => {});
          sentinel = null;
        }
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        /* non supporté, onglet arrière-plan, etc. */
      }
    }

    void acquireWakeLock();

    function onVisibility() {
      if (document.visibilityState === 'visible') void acquireWakeLock();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      html.style.overscrollBehaviorY = prevHtmlOsy;
      body.style.overscrollBehaviorY = prevBodyOsy;
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return <>{children}</>;
}
