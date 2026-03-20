'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import type { BillingInterval } from '@/lib/use-subscription';

type BillingCycleContextValue = {
  billingCycle: BillingInterval;
  setBillingCycle: (cycle: BillingInterval) => void;
  isAnnual: boolean;
};

const BillingCycleContext = createContext<BillingCycleContextValue | null>(null);

export function useBillingCycle() {
  const ctx = useContext(BillingCycleContext);
  if (!ctx) {
    throw new Error('useBillingCycle must be used within BillingCycleProvider');
  }
  return ctx;
}

export function useBillingCycleOptional() {
  return useContext(BillingCycleContext);
}

type Props = {
  children: React.ReactNode;
  defaultCycle?: BillingInterval;
};

/**
 * État global du cycle de facturation (Mensuel/Annuel) pour le catalogue.
 * Initialisé depuis ?annual=1|0 en URL. Au changement de cycle, met à jour l'URL (pricing / landing) pour que le choix survive au retour arrière depuis le Checkout.
 *
 * IMPORTANT : le state démarre toujours à 'month' pour que le rendu serveur
 * et le premier rendu client soient identiques (évite l'erreur d'hydratation).
 * La lecture de l'URL n'a lieu que dans useEffect (côté client seulement).
 */
export function BillingCycleProvider({
  children,
  defaultCycle: _defaultCycle = 'month',
}: Props) {
  const [billingCycle, setBillingCycleState] = useState<BillingInterval>('month');
  const setBillingCycle = useCallback((cycle: BillingInterval) => {
    setBillingCycleState(cycle);
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isPricing = pathname.includes('/pricing');
      const isLanding = pathname === '/' || /^\/[a-z]{2}\/?$/.test(pathname);
      if (isPricing || isLanding) {
        const url = new URL(window.location.href);
        url.searchParams.set('annual', cycle === 'year' ? '1' : '0');
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }
  }, []);
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('annual');
    if (a === '1') setBillingCycleState('year');
    else if (a === '0') setBillingCycleState('month');
  }, []);

  const value = useMemo(
    () => ({
      billingCycle,
      setBillingCycle,
      isAnnual: billingCycle === 'year',
    }),
    [billingCycle, setBillingCycle]
  );

  return (
    <BillingCycleContext.Provider value={value}>
      {children}
    </BillingCycleContext.Provider>
  );
}
