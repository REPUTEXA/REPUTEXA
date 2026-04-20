'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/navigation';
import { isValidIanaTimeZone } from '@/lib/datetime/merchant-timezone';

type Props = {
  /** Valeur brute en base (peut être vide). */
  storedTimeZone: string | null | undefined;
};

/**
 * Détecte Intl.DateTimeFormat().resolvedOptions().timeZone et synchronise le profil si différent ou vide.
 */
export function SyncBrowserTimezone({ storedTimeZone }: Props) {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    let detected: string;
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!detected || !isValidIanaTimeZone(detected)) return;

    const stored = (storedTimeZone ?? '').trim();
    if (stored === detected) return;

    ran.current = true;
    void fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: detected }),
    })
      .then((res) => {
        if (res.ok) router.refresh();
        else ran.current = false;
      })
      .catch(() => {
        ran.current = false;
      });
  }, [storedTimeZone, router]);

  return null;
}
