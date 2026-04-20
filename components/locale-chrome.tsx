'use client';

import { BillingCycleProvider } from '@/lib/billing-cycle-context';
import { BillingCurrencyProvider } from '@/components/billing-currency-provider';
import { SiteCookieBanner } from '@/components/compliance/site-cookie-banner';
import { PwaRegister } from '@/components/pwa/pwa-register';

/**
 * Fournisseurs et widgets client du layout `[locale]`.
 * Export **default** uniquement : les named exports vers `#LocaleChrome` cassent souvent
 * le manifest client Next après HMR / déplacement de fichier — le default est stable côté bundler.
 */
export default function LocaleChrome({ children }: { children: React.ReactNode }) {
  return (
    <BillingCycleProvider>
      <BillingCurrencyProvider>
        <PwaRegister />
        {children}
        <SiteCookieBanner />
      </BillingCurrencyProvider>
    </BillingCycleProvider>
  );
}
