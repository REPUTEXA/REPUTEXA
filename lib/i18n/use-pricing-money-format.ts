'use client';

import { useFormatter } from 'next-intl';
import { useMemo } from 'react';
import { billingCurrencyToIso4217 } from '@/config/pricing';
import { useOptionalBillingCurrency } from '@/components/billing-currency-provider';

const CURRENCY_INTEGER: Pick<
  Intl.NumberFormatOptions,
  'style' | 'minimumFractionDigits' | 'maximumFractionDigits'
> = {
  style: 'currency',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

/** Devise catalogue : cookie `user-currency` si présent, sinon locale (aligné Stripe Checkout). */
export function usePricingCurrencyCode():
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CNY'
  | 'CHF'
  | 'CAD'
  | 'AUD' {
  const { billingCurrency } = useOptionalBillingCurrency();
  return billingCurrencyToIso4217(billingCurrency) as
    | 'USD'
    | 'EUR'
    | 'GBP'
    | 'JPY'
    | 'CNY'
    | 'CHF'
    | 'CAD'
    | 'AUD';
}

/** Prix catalogue formatés via la locale active (symbole et position selon Intl). */
export function useFormatPricingMoney() {
  const format = useFormatter();
  const currency = usePricingCurrencyCode();
  const options = useMemo(() => {
    const base = { ...CURRENCY_INTEGER, currency } satisfies Intl.NumberFormatOptions;
    if (currency === 'JPY' || currency === 'CNY' || currency === 'CAD' || currency === 'AUD') {
      return { ...base, minimumFractionDigits: 0, maximumFractionDigits: 0 } satisfies Intl.NumberFormatOptions;
    }
    return base;
  }, [currency]);
  return useMemo(() => (amount: number) => format.number(amount, options), [format, options]);
}
