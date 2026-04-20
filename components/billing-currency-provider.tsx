'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { localeToBillingCurrency, type BillingCurrency } from '@/config/pricing';
import { isBillingCurrency, parseUserCurrencyFromCookieHeader } from '@/lib/billing/resolve-billing-currency';
import { setUserCurrencyCookieClient } from '@/lib/billing/user-currency-cookie-client';
import {
  clearBillingCurrencyManualPreference,
  readBillingCurrencyManualForSiteLocale,
  readBillingCurrencyManualPreference,
  setBillingCurrencyManualPreference,
} from '@/lib/billing/billing-currency-manual-preference';

type Ctx = {
  billingCurrency: BillingCurrency;
  setBillingCurrency: (c: BillingCurrency) => void;
  /**
   * Toujours false pour l’UI catalogue : la langue pilote la devise par défaut, le cookie la préférence manuelle.
   * Le paiement effectif reste cadré par `resolveBillingCurrencyForCheckout` (profil Stripe) côté API.
   */
  isBillingCurrencyLocked: boolean;
};

const BillingCurrencyContext = createContext<Ctx | null>(null);

function applyUnlockedBillingFromClientPreference(
  setState: React.Dispatch<React.SetStateAction<BillingCurrency>>,
  appLocale: string
): void {
  const defaultForLocale = localeToBillingCurrency(appLocale);
  const manual = readBillingCurrencyManualPreference();
  const manualScope = readBillingCurrencyManualForSiteLocale();
  const fromCookie = parseUserCurrencyFromCookieHeader(
    typeof document !== 'undefined' ? document.cookie : ''
  );
  const manualOk =
    manual &&
    manualScope === appLocale &&
    fromCookie &&
    isBillingCurrency(fromCookie);

  if (manualOk) {
    setState(fromCookie);
    return;
  }
  if (manual && !manualOk) {
    clearBillingCurrencyManualPreference();
  }
  setState(defaultForLocale);
  setUserCurrencyCookieClient(defaultForLocale);
}

export function BillingCurrencyProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const fromLocale = useMemo(() => localeToBillingCurrency(locale), [locale]);
  const [billingCurrency, setState] = useState<BillingCurrency>(fromLocale);

  /**
   * Langue = devise par défaut affichée ; si l’utilisateur a choisi une devise dans le sélecteur,
   * on garde ce choix (voir préférence manuelle + cookie).
   */
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    applyUnlockedBillingFromClientPreference(setState, locale);
  }, [locale]);

  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      applyUnlockedBillingFromClientPreference(setState, locale);
    });
    return () => subscription.unsubscribe();
  }, [locale]);

  const setBillingCurrency = useCallback((c: BillingCurrency) => {
    setBillingCurrencyManualPreference(true, locale);
    setState(c);
    setUserCurrencyCookieClient(c);
  }, [locale]);

  const value = useMemo(
    () => ({ billingCurrency, setBillingCurrency, isBillingCurrencyLocked: false }),
    [billingCurrency, setBillingCurrency],
  );

  return <BillingCurrencyContext.Provider value={value}>{children}</BillingCurrencyContext.Provider>;
}

export function useBillingCurrency(): Ctx {
  const ctx = useContext(BillingCurrencyContext);
  if (!ctx) {
    throw new Error('useBillingCurrency must be used within BillingCurrencyProvider');
  }
  return ctx;
}

/** Hook tolérant : si le provider n’est pas monté, retombe sur la devise dérivée de la locale. */
export function useOptionalBillingCurrency(): Ctx {
  const locale = useLocale();
  const fromLocale = useMemo(() => localeToBillingCurrency(locale), [locale]);
  const ctx = useContext(BillingCurrencyContext);
  const setBillingCurrencyFallback = useCallback((c: BillingCurrency) => {
    setBillingCurrencyManualPreference(true, locale);
    setUserCurrencyCookieClient(c);
  }, [locale]);

  return useMemo(() => {
    if (ctx) return ctx;
    return {
      billingCurrency: fromLocale,
      setBillingCurrency: setBillingCurrencyFallback,
      isBillingCurrencyLocked: false,
    };
  }, [ctx, fromLocale, setBillingCurrencyFallback]);
}
