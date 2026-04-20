'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  MERCHANT_TIMEZONE_FALLBACK,
  resolveMerchantTimeZone,
} from '@/lib/datetime/merchant-timezone';

/** `null` = hors layout dashboard (ex. terminal plein écran) → repli navigateur / Paris. */
const DashboardTimeZoneContext = createContext<string | null>(null);

export function DashboardTimezoneProvider({
  initialTimeZone,
  children,
}: {
  initialTimeZone: string;
  children: React.ReactNode;
}) {
  const resolved = resolveMerchantTimeZone(initialTimeZone);
  const [timeZone, setTimeZone] = useState(resolved);

  useEffect(() => {
    setTimeZone(resolveMerchantTimeZone(initialTimeZone));
  }, [initialTimeZone]);

  const value = useMemo(() => timeZone, [timeZone]);

  return (
    <DashboardTimeZoneContext.Provider value={value}>{children}</DashboardTimeZoneContext.Provider>
  );
}

/** Fuseau affichage : contexte dashboard, sinon navigateur, sinon Paris. */
export function useDashboardDisplayTimeZone(): string {
  const ctx = useContext(DashboardTimeZoneContext);
  if (ctx != null && ctx.trim() !== '') return ctx;
  if (typeof Intl !== 'undefined') {
    try {
      const b = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (b && b.trim()) return b.trim();
    } catch {
      /* ignore */
    }
  }
  return MERCHANT_TIMEZONE_FALLBACK;
}
