'use client';

import { USER_CURRENCY_COOKIE } from '@/lib/billing/resolve-billing-currency';
import type { BillingCurrency } from '@/config/pricing';

const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function setUserCurrencyCookieClient(currency: BillingCurrency): void {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `${USER_CURRENCY_COOKIE}=${currency};path=/;max-age=${ONE_YEAR_SEC};SameSite=Lax${secure}`;
}
