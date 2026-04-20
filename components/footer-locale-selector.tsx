'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildNextLocaleDocumentCookie } from '@/lib/i18n/next-locale-cookie';
import { localeToBillingCurrency } from '@/config/pricing';
import { setUserCurrencyCookieClient } from '@/lib/billing/user-currency-cookie-client';
import { clearBillingCurrencyManualPreference } from '@/lib/billing/billing-currency-manual-preference';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import {
  SITE_LOCALE_CODES,
  SITE_LOCALE_FOOTER_REGION_EN,
  SITE_LOCALE_NATIVE_LABEL,
  type SiteLocaleCode,
} from '@/lib/i18n/site-locales-catalog';

/** Selected-row marker (avoids literal in JSX for i18n lint). */
const FOOTER_LOCALE_SELECTED_MARKER = '\u25CF';

const LOCALES = (SITE_LOCALE_CODES as readonly SiteLocaleCode[]).map((code) => ({
  code,
  label: SITE_LOCALE_NATIVE_LABEL[code],
  region: SITE_LOCALE_FOOTER_REGION_EN[code],
}));

export function FooterLocaleSelector() {
  const tf = useTranslations('FooterLocale');
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        // ignore
      }
    }

    const path = pathname && pathname !== '/' ? pathname : '';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    window.location.href = `/${code}${path}${search}${hash}`;
  };

  return (
    <div ref={ref} className="relative">
      <HoverTooltip label={tf('selectorHint')} side="top">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-opacity duration-300 w-fit mt-1 active:scale-[0.98]"
          aria-label={tf('chooseLanguage')}
          aria-expanded={open}
        >
          <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{current.region} ({current.label})</span>
          <ChevronDown
            className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </HoverTooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 bottom-full mb-2 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-navy shadow-xl z-50"
          >
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelect(l.code)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors duration-200 ${
                  l.code === locale
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{l.label}</span>
                {l.code === locale && (
                  <span className="ml-auto text-[10px] text-gray-500">{FOOTER_LOCALE_SELECTED_MARKER}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
