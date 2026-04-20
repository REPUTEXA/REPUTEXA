'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  SITE_LOCALE_CODES,
  SITE_LOCALE_NATIVE_LABEL,
  SITE_LOCALE_SELECTOR_BADGE,
  type SiteLocaleCode,
} from '@/lib/i18n/site-locales-catalog';
import { buildNextLocaleDocumentCookie } from '@/lib/i18n/next-locale-cookie';
import { normalizePathnameForLocaleSwitch } from '@/lib/i18n/normalize-path-for-locale-switch';
import { localeToBillingCurrency } from '@/config/pricing';
import { setUserCurrencyCookieClient } from '@/lib/billing/user-currency-cookie-client';
import { clearBillingCurrencyManualPreference } from '@/lib/billing/billing-currency-manual-preference';
import { ChevronDown, Globe } from 'lucide-react';
import { HoverTooltip } from '@/components/ui/hover-tooltip';

const LOCALES = (SITE_LOCALE_CODES as readonly SiteLocaleCode[]).map((code) => ({
  code,
  label: SITE_LOCALE_NATIVE_LABEL[code],
  badge: SITE_LOCALE_SELECTOR_BADGE[code],
}));


type Props = {
  variant?: 'dark' | 'light';
  /** `site` = landing and public pricing. `dashboard` = signed-in app shell. */
  hintScope?: 'dashboard' | 'site';
};

export function LanguageSelector({ variant = 'dark', hintScope = 'dashboard' }: Props) {
  const locale = useLocale();
  const tShell = useTranslations('Dashboard.shell');
  const hint =
    hintScope === 'site' ? tShell('languageSelectorHintPublic') : tShell('languageSelectorHint');
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth
      .getSession()
      .then(({ data }) => setIsSignedIn(!!data.session))
      .catch(() => setIsSignedIn(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => setIsSignedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const handleSelect = async (code: string) => {
    setOpen(false);
    if (code === locale) return;

    document.cookie = buildNextLocaleDocumentCookie(code);

    clearBillingCurrencyManualPreference();
    setUserCurrencyCookieClient(localeToBillingCurrency(code));

    if (isSignedIn) {
      try {
        await fetch('/api/user/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: code }),
        });
      } catch {
        /* ignore */
      }
    }

    const path = normalizePathnameForLocaleSwitch(pathname);
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    window.location.href = `/${code}${path}${search}${hash}`;
  };

  return (
    <div ref={ref} className="relative">
      <HoverTooltip label={hint} side="bottom">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            variant === 'light'
              ? 'border-gray-200 bg-white text-zinc-700 hover:border-gray-300 hover:bg-gray-50'
              : 'border-white/20 bg-slate-800 text-zinc-200 hover:border-white/30 hover:text-white'
          }`}
          aria-label={tShell('languageSelectorAria')}
          aria-expanded={open}
        >
          <Globe className="h-4 w-4" aria-hidden />
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                variant === 'light' ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              {current.badge}
            </span>
            <span className="hidden sm:inline">{current.label}</span>
          </span>
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </HoverTooltip>

      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-xl border py-1 shadow-xl ${
            variant === 'light' ? 'border-gray-200 bg-white' : 'border-white/20 bg-slate-800'
          }`}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => handleSelect(l.code)}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition ${
                variant === 'light'
                  ? `hover:bg-gray-100 ${l.code === locale ? 'bg-gray-50 text-indigo-600' : 'text-zinc-700'}`
                  : `hover:bg-slate-700 ${l.code === locale ? 'bg-slate-700 text-indigo-400' : 'text-zinc-300'}`
              }`}
            >
              <span
                className={`w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wider ${
                  variant === 'light' ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                {l.badge}
              </span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
