'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale, useFormatter } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { isUkGeoCountry, readGeoCountryFromDocumentCookie } from '@/lib/i18n/reputexa-geo-country';
import { formatLegalEffectiveDate } from '@/lib/i18n/format-legal-date';
import { isPublicSitePathname } from '@/lib/compliance/public-site-routes';

const ANON_KEY = 'reputexa_consent_uid';

const COOKIE_BANNER_SPRING: Transition = { type: 'spring', damping: 32, stiffness: 380 };
const MOTION_HEIGHT_AUTO = 'auto' as const;

function readNavigatorGpc(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

function getOrCreateAnonId(): string {
  try {
    const exist = localStorage.getItem(ANON_KEY);
    if (exist && exist.length > 8) return exist;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

declare global {
  interface Window {
    __REPUTEXA_COOKIE_CONSENT__?: {
      status: string;
      marketing: boolean;
      analytics: boolean;
    };
  }
}

function AppleSwitch({
  checked,
  disabled,
  onToggle,
  id,
  labelledBy,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  id: string;
  labelledBy?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      className={`relative inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full p-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'
      } ${checked ? 'bg-[#34c759]' : 'bg-zinc-400 dark:bg-zinc-600'}`}
    >
      <span
        className={`pointer-events-none block h-6 w-6 shrink-0 rounded-full bg-white shadow-md ring-1 ring-black/[0.06] transition-transform duration-200 ease-out will-change-transform ${
          checked ? 'translate-x-[1.25rem]' : 'translate-x-0'
        }`}
        aria-hidden
      />
    </button>
  );
}

const SCAN_AT_UTC: DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
};

/**
 * Enveloppe : aucun fetch consent tant que la route n’est pas « site public »
 * (évite erreurs réseau / overlay Next sur `/dashboard`, etc.).
 */
export function SiteCookieBanner() {
  const pathname = usePathname();
  const showOnThisRoute =
    isPublicSitePathname(pathname) ||
    (typeof window !== 'undefined' && isPublicSitePathname(window.location.pathname));
  if (!showOnThisRoute) return null;
  return <SiteCookieBannerInner />;
}

function SiteCookieBannerInner() {
  const pathname = usePathname();
  const locale = useLocale();
  const format = useFormatter();
  const tEu = useTranslations('Compliance.cookieBanner');
  const tUk = useTranslations('Compliance.cookieBannerUk');
  const [ukVisitor, setUkVisitor] = useState(false);
  const t = useMemo(() => (ukVisitor ? tUk : tEu), [ukVisitor, tEu, tUk]);

  useEffect(() => {
    setUkVisitor(isUkGeoCountry(readGeoCountryFromDocumentCookie()));
  }, []);

  const titleId = useId();
  const descId = useId();
  const essLabel = useId();
  const anLabel = useId();
  const mkLabel = useId();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [analyticsOn, setAnalyticsOn] = useState(false);
  const [marketingOn, setMarketingOn] = useState(false);
  const [legalEffectiveDate, setLegalEffectiveDate] = useState<string | null>(null);
  const [cookieInventoryHint, setCookieInventoryHint] = useState<string | null>(null);
  const [guardianLastRunAt, setGuardianLastRunAt] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [serverGpc, setServerGpc] = useState(false);
  const [consentVersionGate, setConsentVersionGate] = useState(0);
  const gpcStorageFallbackLock = useRef(false);

  const browserGpc = readNavigatorGpc();
  const showGpcLine = serverGpc || browserGpc;

  const refresh = useCallback(async () => {
    try {
      let aid: string | null = null;
      try {
        aid = getOrCreateAnonId();
        setAnonId(aid);
      } catch {
        aid = null;
      }
      const params = new URLSearchParams();
      if (aid) params.set('anonymous_id', aid);
      params.set('ui_locale', locale);
      const res = await fetch(`/api/consent/site?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        setVisible(true);
        setAnalyticsOn(false);
        setMarketingOn(false);
        return;
      }
      let data: {
        needsBanner?: boolean;
        currentLegalVersion?: number;
        legalEffectiveDate?: string | null;
        cookieInventoryHint?: string | null;
        guardianLastRunAt?: string | null;
        toggleDefaults?: { analytics?: boolean; marketing?: boolean };
        globalPrivacyControl?: boolean;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        setVisible(true);
        setAnalyticsOn(false);
        setMarketingOn(false);
        return;
      }
      setServerGpc(data.globalPrivacyControl === true);
      setConsentVersionGate(
        typeof data.currentLegalVersion === 'number' && Number.isFinite(data.currentLegalVersion)
          ? data.currentLegalVersion
          : 0
      );
      setVisible(!!data.needsBanner);
      const td = data.toggleDefaults;
      if (td && typeof td === 'object') {
        setAnalyticsOn(!!td.analytics);
        setMarketingOn(!!td.marketing);
      } else {
        setAnalyticsOn(false);
        setMarketingOn(false);
      }
      setLegalEffectiveDate(
        typeof data.legalEffectiveDate === 'string' && data.legalEffectiveDate ? data.legalEffectiveDate : null
      );
      setCookieInventoryHint(
        typeof data.cookieInventoryHint === 'string' && data.cookieInventoryHint.trim()
          ? data.cookieInventoryHint.trim()
          : null
      );
      setGuardianLastRunAt(
        typeof data.guardianLastRunAt === 'string' && data.guardianLastRunAt.trim()
          ? data.guardianLastRunAt.trim()
          : null
      );
    } catch {
      setVisible(true);
      setAnalyticsOn(false);
      setMarketingOn(false);
    }
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const persistChoice = useCallback(async (nextA: boolean, nextM: boolean): Promise<boolean> => {
    setBusy(true);
    try {
      const id = anonId ?? getOrCreateAnonId();
      setAnonId(id);
      const navigatorLanguage = typeof navigator !== 'undefined' ? navigator.language : '';
      const gpcObserved = readNavigatorGpc();
      const res = await fetch('/api/consent/site', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymous_id: id,
          ui_locale: locale,
          navigator_language: navigatorLanguage,
          analytics_opt_in: nextA,
          marketing_opt_in: nextM,
          gpc_signal_observed: gpcObserved,
        }),
      });
      if (res.ok) {
        const st = nextA && nextM ? 'all' : !nextA && !nextM ? 'necessary' : 'partial';
        window.__REPUTEXA_COOKIE_CONSENT__ = {
          status: st,
          marketing: nextM,
          analytics: nextA,
        };
        setVisible(false);
        setDetailsOpen(false);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [anonId, locale]);

  useEffect(() => {
    if (!visible || busy) return;
    const navGpc = readNavigatorGpc();
    if (!serverGpc && !navGpc) return;
    const storageKey = `reputexa_gpc_autosync:v${consentVersionGate}`;
    let lockedSession = false;
    try {
      const cur = sessionStorage.getItem(storageKey);
      if (cur === '1' || cur === 'pending') return;
      sessionStorage.setItem(storageKey, 'pending');
      lockedSession = true;
    } catch {
      if (gpcStorageFallbackLock.current) return;
      gpcStorageFallbackLock.current = true;
    }
    setAnalyticsOn(false);
    setMarketingOn(false);
    void (async () => {
      try {
        const ok = await persistChoice(false, false);
        if (lockedSession) {
          try {
            if (ok) sessionStorage.setItem(storageKey, '1');
            else sessionStorage.removeItem(storageKey);
          } catch {
            /* ignore */
          }
        } else if (!ok) {
          gpcStorageFallbackLock.current = false;
        }
      } catch {
        /* persistChoice ne doit plus rejeter ; sécurité overlay Next */
      }
    })();
  }, [visible, serverGpc, busy, persistChoice, consentVersionGate]);

  function saveCurrentToggles() {
    void persistChoice(analyticsOn, marketingOn);
  }

  function acceptAllQuick() {
    setAnalyticsOn(true);
    setMarketingOn(true);
    void persistChoice(true, true);
  }

  function rejectOptionalQuick() {
    setAnalyticsOn(false);
    setMarketingOn(false);
    void persistChoice(false, false);
  }

  const updatedLine =
    legalEffectiveDate &&
    t('legalUpdatedLine', { date: formatLegalEffectiveDate(legalEffectiveDate, locale) });

  const scanLine =
    guardianLastRunAt &&
    (() => {
      try {
        return t('scanSyncedLine', {
          datetime: format.dateTime(new Date(guardianLastRunAt), SCAN_AT_UTC),
        });
      } catch {
        return t('scanSyncedLine', { datetime: guardianLastRunAt });
      }
    })();

  const cat = {
    essentialTitle: t('catEssentialTitle'),
    essentialDesc: t('catEssentialDesc'),
    analyticsTitle: t('catAnalyticsTitle'),
    analyticsDesc: t('catAnalyticsDesc'),
    marketingTitle: t('catMarketingTitle'),
    marketingDesc: t('catMarketingDesc'),
    saveChoices: t('saveChoices'),
    quickAccept: t('quickAccept'),
    quickReject: t('quickReject'),
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={detailsOpen ? descId : undefined}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={COOKIE_BANNER_SPRING}
          className="fixed bottom-0 left-0 right-0 z-[9999] print:hidden border-t border-zinc-300 bg-zinc-100/95 px-2 pb-2 pt-1 dark:border-zinc-700 dark:bg-zinc-950"
        >
          <div className="mx-auto max-w-lg sm:max-w-xl rounded-t-2xl border border-zinc-200 bg-white px-4 py-3.5 text-zinc-900 shadow-xl shadow-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p id={titleId} className="text-[15px] font-semibold leading-snug tracking-tight text-zinc-950 dark:text-white">
                  {t('title')}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">{t('subtitle')}</p>
                {showGpcLine ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-1.5 text-[12px] leading-snug text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-200" aria-hidden />
                    <span>{t('gpcLine')}</span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={busy}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label={t('closeAria')}
                onClick={() => void rejectOptionalQuick()}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <ul className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50/80 dark:divide-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/50">
              <li className="flex items-center gap-3 px-3 py-3 sm:px-3.5">
                <div className="min-w-0 flex-1">
                  <p id={essLabel} className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {cat.essentialTitle}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">{cat.essentialDesc}</p>
                </div>
                <AppleSwitch checked disabled id={`${essLabel}-sw`} labelledBy={essLabel} onToggle={() => {}} />
              </li>
              <li className="flex items-center gap-3 px-3 py-3 sm:px-3.5">
                <div className="min-w-0 flex-1">
                  <p id={anLabel} className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {cat.analyticsTitle}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">{cat.analyticsDesc}</p>
                </div>
                <AppleSwitch
                  id={`${anLabel}-sw`}
                  labelledBy={anLabel}
                  checked={analyticsOn}
                  disabled={busy}
                  onToggle={() => setAnalyticsOn((v) => !v)}
                />
              </li>
              <li className="flex items-center gap-3 px-3 py-3 sm:px-3.5">
                <div className="min-w-0 flex-1">
                  <p id={mkLabel} className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {cat.marketingTitle}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-zinc-600 dark:text-zinc-400">{cat.marketingDesc}</p>
                </div>
                <AppleSwitch
                  id={`${mkLabel}-sw`}
                  labelledBy={mkLabel}
                  checked={marketingOn}
                  disabled={busy}
                  onToggle={() => setMarketingOn((v) => !v)}
                />
              </li>
            </ul>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-1 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void rejectOptionalQuick()}
                  className="h-9 w-full rounded-full border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:min-w-[132px]"
                >
                  {cat.quickReject}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveCurrentToggles()}
                  className="h-9 w-full rounded-full bg-zinc-900 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto sm:min-w-[140px]"
                >
                  {cat.saveChoices}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void acceptAllQuick()}
                  className="h-9 w-full rounded-full border border-zinc-300 bg-white px-4 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:min-w-[132px]"
                >
                  {cat.quickAccept}
                </button>
              </div>
              <Link
                href="/legal/confidentialite"
                className="w-full text-center text-xs font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300 sm:w-auto sm:self-center sm:text-right"
              >
                {t('learnMore')}
              </Link>
            </div>

            <div className="mt-2 flex items-center gap-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-800 dark:text-zinc-300"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((o) => !o)}
              >
                {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? t('hideDetails') : t('showDetails')}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {detailsOpen ? (
                <motion.div
                  id={descId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: MOTION_HEIGHT_AUTO, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-36 space-y-2 overflow-y-auto overscroll-contain border-t border-zinc-200 pt-3 text-[12px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                    <p>{t('desc')}</p>
                    <p className="text-zinc-700 dark:text-zinc-400">{cookieInventoryHint ?? t('cookieSyncHint')}</p>
                    {updatedLine ? <p className="text-zinc-700 dark:text-zinc-400">{updatedLine}</p> : null}
                    {scanLine ? <p className="text-zinc-700 dark:text-zinc-400">{scanLine}</p> : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
