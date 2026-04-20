'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Lock } from 'lucide-react';
import type { BillingCurrency } from '@/config/pricing';
import { useOptionalBillingCurrency } from '@/components/billing-currency-provider';
import { HoverTooltip } from '@/components/ui/hover-tooltip';

const ORDER: BillingCurrency[] = ['eur', 'usd', 'gbp', 'jpy', 'cny', 'chf', 'cad', 'aud'];

const LABEL: Record<BillingCurrency, string> = {
  eur: 'EUR',
  usd: 'USD',
  gbp: 'GBP',
  jpy: 'JPY',
  cny: 'CNY',
  chf: 'CHF',
  cad: 'CAD',
  aud: 'AUD',
};

/** Libellé court sur le bouton (évite l’ambiguïté JPY / CNY). */
const BUTTON_FACE: Record<BillingCurrency, string> = {
  eur: '€',
  usd: '$',
  gbp: '£',
  jpy: '¥',
  cny: 'CN¥',
  chf: 'CHF',
  cad: 'CA$',
  aud: 'A$',
};

type Props = { variant?: 'dark' | 'light' };

export function CurrencySelector({ variant = 'dark' }: Props) {
  const tShell = useTranslations('Dashboard.shell');
  const { billingCurrency, setBillingCurrency, isBillingCurrencyLocked } = useOptionalBillingCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tip = isBillingCurrencyLocked
    ? tShell('currencySelectorLockedHint', { code: LABEL[billingCurrency] })
    : tShell('currencySelectorHint');

  return (
    <div ref={ref} className="relative">
      <HoverTooltip label={tip} side="bottom">
        <button
          type="button"
          disabled={isBillingCurrencyLocked}
          onClick={() => {
            if (isBillingCurrencyLocked) return;
            setOpen(!open);
          }}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            isBillingCurrencyLocked
              ? variant === 'light'
                ? 'border-gray-200 bg-gray-50 text-zinc-500 cursor-not-allowed'
                : 'border-white/15 bg-slate-800/80 text-zinc-400 cursor-not-allowed'
              : variant === 'light'
                ? 'border-gray-200 bg-white text-zinc-700 hover:border-gray-300 hover:bg-gray-50'
                : 'border-white/20 bg-slate-800 text-zinc-200 hover:border-white/30 hover:text-white'
          }`}
          aria-label={
            isBillingCurrencyLocked ? tShell('currencySelectorLockedAria') : tShell('currencySelectorAria')
          }
          aria-expanded={isBillingCurrencyLocked ? undefined : open}
        >
          <span className="min-w-[2.25rem] text-center font-semibold tabular-nums">{BUTTON_FACE[billingCurrency]}</span>
          {isBillingCurrencyLocked ? (
            <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          ) : (
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
          )}
        </button>
      </HoverTooltip>

      {open && !isBillingCurrencyLocked && (
        <div
          className={`absolute right-0 top-full z-50 mt-2 min-w-[140px] overflow-hidden rounded-xl border py-1 shadow-xl ${
            variant === 'light' ? 'border-gray-200 bg-white' : 'border-white/20 bg-slate-800'
          }`}
        >
          {ORDER.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setBillingCurrency(code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition ${
                variant === 'light'
                  ? `hover:bg-gray-100 ${code === billingCurrency ? 'bg-gray-50 text-indigo-600' : 'text-zinc-700'}`
                  : `hover:bg-slate-700 ${code === billingCurrency ? 'bg-slate-700 text-indigo-400' : 'text-zinc-300'}`
              }`}
            >
              <span className="font-medium tabular-nums">{BUTTON_FACE[code]}</span>
              <span className="text-xs opacity-80">{LABEL[code]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
