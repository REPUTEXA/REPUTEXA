'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Cake,
  Copy,
  Gift,
  History,
  Info,
  Loader2,
  Lock,
  MonitorSmartphone,
  Pencil,
  Search,
  ShoppingBag,
  Smartphone,
  Star,
  UserRound,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions, NumberFormatOptions } from 'use-intl';
import { Link } from '@/i18n/navigation';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { useDashboardDisplayTimeZone } from '@/components/dashboard/dashboard-timezone-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/client';
import { activeLoyaltyProgram, type BananoLoyaltyMerchantConfig } from '@/lib/banano/loyalty-profile';
import {
  effectiveEarnCredit,
  isBonusPerEuroStackingActive,
  isLoyaltyBonusCreditingNow,
} from '@/lib/banano/loyalty-bonus';
import { BananoLoyaltyMerchantSettings } from '@/components/banano/banano-loyalty-merchant-settings';
import { playEarnCreditFeedback } from '@/lib/banano/earn-feedback';
import { isBirthdayToday, type TimelineItem } from '@/lib/banano/loyalty-timeline-labels';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';
import { dispatchBananoStaffAllowanceSync } from '@/lib/banano/staff-allowance-client-sync';
import { formatReductionForMessage } from '@/lib/banano/banano-automation-defaults';
import { PREFERRED_LOCALE_LABEL } from '@/lib/banano/member-preferred-locale';
import {
  enqueueOfflineItem,
  loadOfflineQueue,
  offlineQueueItemAgeMs,
  removeOfflineItemByKey,
  shouldEnqueueOfflineRetry,
  offlineQueueHasStaleItems,
  offlineQueueItemIsStale,
  type OfflineQueueItem,
  type OfflineTransactPayload,
} from '@/lib/banano/terminal-offline-queue';

const BANANO_PIN_SESSION_KEY = 'banano_terminal_pin_unlocked_v1';
const BANANO_STAFF_SESSION_KEY = 'banano_terminal_staff_session_v1';
const BANANO_PIN_LOCAL_KEY = 'banano_terminal_pin_unlocked_v2';
const BANANO_STAFF_LOCAL_KEY = 'banano_terminal_staff_session_v2';
const TERMINAL_REGISTER_STORAGE_KEY = 'banano_terminal_register_id_v1';

const INTL_BIRTHDAY_DAY_MONTH: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
};
const MERCHANT_TIMELINE_DT_OPTS: DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
};
const INTL_EUR_CURRENCY_OPTS: NumberFormatOptions = { style: 'currency', currency: 'EUR' };
const TIMELINE_DETAILS_CHEVRON = '\u25BC';

type StaffSession = { id: string; displayName: string };

function persistMerchantPinUnlocked() {
  try {
    localStorage.setItem(BANANO_PIN_LOCAL_KEY, '1');
    sessionStorage.setItem(BANANO_PIN_SESSION_KEY, '1');
  } catch {
    /* navigation privée, quotas */
  }
}

function readMerchantPinUnlocked(): boolean {
  try {
    if (localStorage.getItem(BANANO_PIN_LOCAL_KEY) === '1') return true;
    if (sessionStorage.getItem(BANANO_PIN_SESSION_KEY) === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

function persistStaffSession(sess: StaffSession) {
  const raw = JSON.stringify(sess);
  try {
    localStorage.setItem(BANANO_STAFF_LOCAL_KEY, raw);
    sessionStorage.setItem(BANANO_STAFF_SESSION_KEY, raw);
  } catch {
    /* ignore */
  }
}

function readStaffSessionRaw(): string | null {
  try {
    return localStorage.getItem(BANANO_STAFF_LOCAL_KEY) ?? sessionStorage.getItem(BANANO_STAFF_SESSION_KEY);
  } catch {
    return null;
  }
}

function clearPersistedStaffSession() {
  try {
    localStorage.removeItem(BANANO_STAFF_LOCAL_KEY);
    sessionStorage.removeItem(BANANO_STAFF_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Recherche API : priorité au téléphone (≥ 3 chiffres), sinon nom caisse (≥ 2 caractères normalisés). */
function loyaltySearchQueryFromFields(nameRaw: string, phoneRaw: string): string | null {
  const phone = phoneRaw.trim();
  if (phone.replace(/\D/g, '').length >= 3) {
    return phone;
  }
  const name = formatTerminalClientName(nameRaw.trim());
  if (name.length >= 2) {
    return name;
  }
  return null;
}

type BirthdayOfferPayload = {
  automationEnabled: boolean;
  hasReduction: boolean;
  discount_kind: 'none' | 'percent' | 'fixed';
  discount_percent: number;
  discount_fixed_cents: number;
};

type BootstrapPayload = {
  pinConfigured: boolean;
  terminalPublicSlug?: string;
  loyalty: BananoLoyaltyMerchantConfig;
  establishmentName?: string | null;
  activeTerminalStaff?: { id: string; display_name: string }[];
  birthdayOffer?: BirthdayOfferPayload;
};

function staffVoucherIssuedCents(v: TerminalVoucherRow): number {
  if (v.initial_euro_cents != null) return Math.max(0, Math.floor(Number(v.initial_euro_cents)));
  if (v.threshold_snapshot != null) return Math.max(0, Math.floor(Number(v.threshold_snapshot)));
  return 0;
}

function parseTicketEurosStrict(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const x = parseFloat(t);
  if (!Number.isFinite(x) || x <= 0 || x > 100_000) return null;
  return x;
}

function priceEurAfterBirthdayDiscount(grossEur: number, offer: BirthdayOfferPayload): number | null {
  if (!offer.hasReduction) return null;
  const grossCents = Math.round(grossEur * 100);
  if (offer.discount_kind === 'percent' && offer.discount_percent > 0) {
    return Math.round((grossCents * (100 - offer.discount_percent)) / 100) / 100;
  }
  if (offer.discount_kind === 'fixed' && offer.discount_fixed_cents > 0) {
    return Math.max(0, grossCents - offer.discount_fixed_cents) / 100;
  }
  return null;
}

/** display_name caisse « NOM PRÉNOM » → champs édition. */
function splitDisplayForEdit(display: string): { last: string; first: string } {
  const p = display.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return { last: '', first: '' };
  if (p.length === 1) return { last: p[0]!, first: '' };
  return { last: p[0]!, first: p.slice(1).join(' ') };
}

type BootState = {
  pinConfigured: boolean;
};

type Member = {
  id: string;
  phone_e164: string;
  preferred_locale?: string | null;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  points_balance: number;
  stamps_balance: number;
  crm_role?: string | null;
};

type TerminalVoucherRow = {
  id: string;
  public_code: string;
  status: string;
  rewardLine: string;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  voucher_class?: string;
  remaining_euro_cents?: number | null;
  initial_euro_cents?: number | null;
  threshold_snapshot?: number | null;
};

type VoucherRedeemModalState = {
  code: string;
  kind: 'loyalty_one_shot' | 'staff_allowance';
  remainingCents: number;
  suggestedDebitCents: number;
};

type Props = {
  /** Plein écran sans menu dashboard (`/[locale]/terminal/[slug]`). */
  layoutVariant?: 'dashboard' | 'fullscreen';
  /** Formulaire réglages fidélité (défaut : oui si `layoutVariant === 'dashboard'`). */
  merchantLoyaltySettings?: boolean;
  /** Slug URL serveur (sinon complété par le bootstrap). */
  terminalPublicSlug?: string;
  /** IANA — prioritaire sur le contexte dashboard / navigateur. */
  displayTimeZone?: string;
};

function PinPad({
  value,
  onChange,
  maxLen,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLen: number;
}) {
  const t = useTranslations('Dashboard.bananoTerminal');
  const add = (d: string) => {
    if (value.length >= maxLen) return;
    onChange(value + d);
  };
  const back = () => onChange(value.slice(0, -1));

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2 min-h-[44px] items-center">
        <span className="text-2xl font-mono tracking-[0.35em] text-slate-900 dark:text-slate-100">
          {value.replace(/\d/g, '•')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => add(d)}
            className="h-14 rounded-2xl text-lg font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-transform touch-manipulation select-none"
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={back}
          className="h-14 rounded-2xl text-sm font-medium bg-slate-200/80 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-zinc-600 touch-manipulation select-none"
        >
          {t('pinPadBackspace')}
        </button>
        <button
          type="button"
          onClick={() => add('0')}
          className="h-14 rounded-2xl text-lg font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98] touch-manipulation select-none"
        >
          0
        </button>
        <span className="h-14" aria-hidden />
      </div>
    </div>
  );
}

export function BananoTerminalApp({
  layoutVariant = 'dashboard',
  merchantLoyaltySettings: merchantLoyaltySettingsProp,
  terminalPublicSlug: terminalPublicSlugProp,
  displayTimeZone: displayTimeZoneProp,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('Dashboard.bananoTerminal');
  const intlTag = siteLocaleToIntlDateTag(locale);
  const dashboardTzFromCtx = useDashboardDisplayTimeZone();
  const merchantDisplayTz = (displayTimeZoneProp?.trim() || dashboardTzFromCtx).trim();

  const formatMerchantDt = useCallback(
    (iso: string, options?: DateTimeFormatOptions) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat(intlTag, { timeZone: merchantDisplayTz, ...options }).format(d);
    },
    [intlTag, merchantDisplayTz]
  );

  const formatOfflineItemLabel = useCallback(
    (item: OfflineQueueItem) => {
      if (item.op === 'transact') {
        const k = item.payload.kind === 'earn_visit' ? t('offlineOpEarn') : t('offlineOpDebit');
        return `${k} · ${item.memberLabel}`;
      }
      const debit =
        item.debitEuroCents != null && item.debitEuroCents >= 1
          ? ` · ${(item.debitEuroCents / 100).toFixed(2)} €`
          : '';
      return t('offlineVoucherLine', { code: item.code, debit, member: item.memberLabel });
    },
    [t]
  );

  const staleAgeLabel = useCallback((iso: string) => {
    const ms = offlineQueueItemAgeMs(iso);
    const hours = Math.floor(ms / 3600000);
    if (hours < 48) return t('staleAgeHours', { n: Math.max(1, hours) });
    const days = Math.floor(hours / 24);
    return t('staleAgeDays', { n: days });
  }, [t]);

  const [terminalSlugBoot, setTerminalSlugBoot] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string | null>(null);

  const terminalPublicSlugResolved = (terminalPublicSlugProp ?? terminalSlugBoot ?? '').trim();

  const terminalPathOnly = useMemo(() => {
    if (terminalPublicSlugResolved) return `/terminal/${terminalPublicSlugResolved}` as const;
    return '/terminal' as const;
  }, [terminalPublicSlugResolved]);

  const terminalAbsoluteUrl = useMemo(() => {
    const base = getSiteUrl().replace(/\/$/, '');
    if (terminalPublicSlugResolved) return `${base}/${locale}/terminal/${terminalPublicSlugResolved}`;
    return `${base}/${locale}/terminal`;
  }, [locale, terminalPublicSlugResolved]);

  const showMerchantLoyaltySettings =
    merchantLoyaltySettingsProp ?? layoutVariant === 'dashboard';
  const pinGateActive = layoutVariant !== 'fullscreen';

  const [boot, setBoot] = useState<BootState | null>(null);
  const [loyaltyCfg, setLoyaltyCfg] = useState<BananoLoyaltyMerchantConfig | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [searchClientName, setSearchClientName] = useState('');
  const [searchClientPhone, setSearchClientPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);

  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newAddressLine, setNewAddressLine] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPostal, setNewPostal] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [redeemPts, setRedeemPts] = useState('');
  const [visitNote, setVisitNote] = useState('');
  const [visitTicketEuros, setVisitTicketEuros] = useState('');
  const [visitItemsCount, setVisitItemsCount] = useState('');
  const [transBusy, setTransBusy] = useState(false);
  const [memberVouchers, setMemberVouchers] = useState<TerminalVoucherRow[]>([]);
  const [memberVouchersLoading, setMemberVouchersLoading] = useState(false);
  const [voucherRedeemInput, setVoucherRedeemInput] = useState('');
  const [voucherRedeemBusy, setVoucherRedeemBusy] = useState(false);
  const [terminalVoucherFocus, setTerminalVoucherFocus] = useState<string | null>(null);
  const [voucherRedeemModal, setVoucherRedeemModal] = useState<VoucherRedeemModalState | null>(null);
  const [staffVoucherDebitEuros, setStaffVoucherDebitEuros] = useState('');
  const [timelineVersion, setTimelineVersion] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [offlineSyncBusy, setOfflineSyncBusy] = useState(false);
  const [terminalRegisterId, setTerminalRegisterId] = useState('');
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const availableTerminalVouchers = useMemo(
    () => memberVouchers.filter((x) => x.status === 'available'),
    [memberVouchers]
  );

  const offlineQueueHasStale = useMemo(
    () => offlineQueueHasStaleItems(offlineQueue),
    [offlineQueue]
  );

  /** Plein écran employé : masque l’interface sans PIN (équivalent « poser la tablette »). */
  const [employeePrivacyLock, setEmployeePrivacyLock] = useState(false);

  const [activeTerminalStaff, setActiveTerminalStaff] = useState<{ id: string; display_name: string }[]>(
    []
  );
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffPickId, setStaffPickId] = useState<string | null>(null);
  const [staffPinEntry, setStaffPinEntry] = useState('');
  const [staffPinBusy, setStaffPinBusy] = useState(false);

  const [clientTimeline, setClientTimeline] = useState<TimelineItem[]>([]);
  const [timelineDetail, setTimelineDetail] = useState<TimelineItem | null>(null);
  const [clientTimelineLoading, setClientTimelineLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editLast, setEditLast] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editAddressLine, setEditAddressLine] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPostal, setEditPostal] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const [birthdayOfferBoot, setBirthdayOfferBoot] = useState<BirthdayOfferPayload | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const existing = localStorage.getItem(TERMINAL_REGISTER_STORAGE_KEY)?.trim() ?? '';
      if (existing) {
        setTerminalRegisterId(existing);
        return;
      }
      const slug = terminalPublicSlugResolved.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32);
      const v = slug
        ? `caisse-${slug}`
        : `caisse-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
      localStorage.setItem(TERMINAL_REGISTER_STORAGE_KEY, v);
      setTerminalRegisterId(v);
    } catch {
      setTerminalRegisterId('');
    }
  }, [terminalPublicSlugResolved]);

  const loadBootstrap = useCallback(async () => {
    setBootErr(null);
    try {
      const res = await fetch('/api/banano/bootstrap');
      const data = (await res.json()) as BootstrapPayload & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errLoad'));
      if (!data.loyalty) throw new Error(t('errBootstrapInvalid'));
      setBoot({ pinConfigured: data.pinConfigured });
      setLoyaltyCfg(data.loyalty);
      if (data.terminalPublicSlug?.trim()) {
        setTerminalSlugBoot(data.terminalPublicSlug.trim());
      }
      setActiveTerminalStaff(
        Array.isArray(data.activeTerminalStaff) ? data.activeTerminalStaff : []
      );
      setBirthdayOfferBoot(data.birthdayOffer ?? null);
      const en = data.establishmentName;
      setEstablishmentName(
        typeof en === 'string' && en.trim().length > 0 ? en.trim() : null
      );
    } catch (e) {
      setBootErr(e instanceof Error ? e.message : t('errGeneric'));
    }
  }, [t]);

  const lockTerminal = useCallback(() => {
    setSelected(null);
    setSearchClientName('');
    setSearchClientPhone('');
    setMembers([]);
    setMemberVouchers([]);
    setVoucherRedeemInput('');
    setTerminalVoucherFocus(null);
    setEmployeePrivacyLock(true);
    toast.message(t('toastTerminalLocked'));
  }, [t]);

  const loadMemberVouchers = useCallback(async (memberId: string) => {
    setMemberVouchersLoading(true);
    try {
      const res = await fetch(`/api/banano/loyalty/members/${memberId}/vouchers`);
      const data = (await res.json()) as { vouchers?: TerminalVoucherRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      setMemberVouchers(data.vouchers ?? []);
    } catch {
      setMemberVouchers([]);
    } finally {
      setMemberVouchersLoading(false);
    }
  }, [t]);

  const flushOfflineQueue = useCallback(async () => {
    let q = loadOfflineQueue();
    if (q.length === 0) return;
    setOfflineSyncBusy(true);
    try {
      while (q.length > 0) {
        const item = q[0]!;
        try {
          if (item.op === 'transact') {
            const res = await fetch('/api/banano/loyalty/transact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...item.payload, idempotencyKey: item.idempotencyKey }),
            });
            const data = (await res.json()) as { error?: string; member?: Member };
            if (!res.ok) {
              if (res.status === 401) {
                toast.error(t('toastSessionExpiredSync'));
                break;
              }
              if (res.status >= 400 && res.status < 500) {
                removeOfflineItemByKey(item.idempotencyKey);
                toast.error(
                  data.error ?? t('toastQueueRemovedStale')
                );
                q = loadOfflineQueue();
                continue;
              }
              break;
            }
            removeOfflineItemByKey(item.idempotencyKey);
            toast.success(t('toastOfflineSaved'));
            if (data.member) {
              setSelected((prev) => (prev?.id === item.memberId ? data.member! : prev));
            }
            void loadMemberVouchers(item.memberId);
            q = loadOfflineQueue();
            continue;
          }

          const body: Record<string, unknown> = {
            code: item.code,
            memberId: item.memberId,
            idempotencyKey: item.idempotencyKey,
          };
          if (item.staffId) body.staffId = item.staffId;
          if (item.debitEuroCents != null && item.debitEuroCents >= 1) {
            body.debitEuroCents = item.debitEuroCents;
          }
          const res = await fetch('/api/banano/loyalty/vouchers/redeem', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            if (res.status === 401) {
              toast.error(t('toastSessionExpiredSync'));
              break;
            }
            if (res.status >= 400 && res.status < 500) {
              removeOfflineItemByKey(item.idempotencyKey);
              toast.error(data.error ?? t('toastValidationRemoved'));
              q = loadOfflineQueue();
              continue;
            }
            break;
          }
          removeOfflineItemByKey(item.idempotencyKey);
          toast.success(t('toastBonValidatedOffline'));
          void loadMemberVouchers(item.memberId);
          q = loadOfflineQueue();
        } catch {
          break;
        }
      }
    } finally {
      setOfflineQueue(loadOfflineQueue());
      setOfflineSyncBusy(false);
      setTimelineVersion((v) => v + 1);
    }
  }, [loadMemberVouchers, t]);

  useEffect(() => {
    setOfflineQueue(loadOfflineQueue());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    if (loadOfflineQueue().length === 0) return;
    void flushOfflineQueue();
    // Intentionnel : une seule tentative au montage du terminal si une file existe déjà (ex. onglet réouvert).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUp = () => {
      setNetworkOnline(true);
      void flushOfflineQueue();
    };
    const onDown = () => setNetworkOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, [flushOfflineQueue]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadBootstrap();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadBootstrap]);

  useEffect(() => {
    if (!pinGateActive || !boot?.pinConfigured) return;
    if (typeof window !== 'undefined' && readMerchantPinUnlocked()) {
      setUnlocked(true);
    }
  }, [boot?.pinConfigured, pinGateActive]);

  useEffect(() => {
    if (layoutVariant !== 'fullscreen') return;
    try {
      const raw = readStaffSessionRaw();
      if (!raw) return;
      const p = JSON.parse(raw) as { id?: string; displayName?: string };
      if (p?.id && p?.displayName) setStaffSession({ id: p.id, displayName: p.displayName });
    } catch {
      /* ignore */
    }
  }, [layoutVariant]);

  useEffect(() => {
    if (layoutVariant !== 'fullscreen') return;
    if (activeTerminalStaff.length === 0) {
      if (staffSession) {
        setStaffSession(null);
        setStaffPickId(null);
        setStaffPinEntry('');
        clearPersistedStaffSession();
      }
      return;
    }
    if (!staffSession) return;
    const still = activeTerminalStaff.some((s) => s.id === staffSession.id);
    if (!still) {
      setStaffSession(null);
      setStaffPickId(null);
      setStaffPinEntry('');
      clearPersistedStaffSession();
      toast.message(t('toastTeamUpdated'));
    }
  }, [layoutVariant, activeTerminalStaff, staffSession, t]);

  const effectiveUnlocked = useMemo(
    () =>
      pinGateActive ? unlocked : Boolean(boot && loyaltyCfg),
    [pinGateActive, unlocked, boot, loyaltyCfg]
  );

  const earnCredit = useMemo(() => {
    if (!loyaltyCfg) return { points: 0, stamps: 0 };
    return effectiveEarnCredit({
      mode: loyaltyCfg.mode,
      pointsPerVisit: loyaltyCfg.pointsPerVisit,
      stampsPerVisit: loyaltyCfg.stampsPerVisit,
      bonus: loyaltyCfg.bonus,
    });
  }, [loyaltyCfg]);

  const bonusCreditLive = useMemo(() => {
    if (!loyaltyCfg) return false;
    return isLoyaltyBonusCreditingNow(loyaltyCfg.bonus);
  }, [loyaltyCfg]);

  /** Taux bonus par € (cumul avec le taux base) — peut être actif même si forfait visite bonus ne l’est pas. */
  const bonusPerEuroLive = useMemo(() => {
    if (!loyaltyCfg) return false;
    return isBonusPerEuroStackingActive(loyaltyCfg.bonus, loyaltyCfg.mode);
  }, [loyaltyCfg]);

  /** Points sur « Achat » : ceil(€ × (taux base + bonus/€)) + forfait legacy éventuel. */
  const earnPointsTotalPreview = useMemo(() => {
    if (!loyaltyCfg || loyaltyCfg.mode !== 'points') return earnCredit.points;
    const ppe = loyaltyCfg.pointsPerEuro;
    if (!(ppe > 0)) return bonusCreditLive ? loyaltyCfg.bonus.pointsExtraPerVisit : 0;
    const gross = parseTicketEurosStrict(visitTicketEuros);
    const addPe = bonusPerEuroLive ? Math.max(0, Number(loyaltyCfg.bonus.pointsExtraPerEuro) || 0) : 0;
    const legacyFlat =
      bonusCreditLive && addPe <= 0 ? Math.max(0, loyaltyCfg.bonus.pointsExtraPerVisit) : 0;
    const rate = ppe + Math.max(0, addPe);
    const fromSpend = gross != null ? Math.ceil(gross * rate) + legacyFlat : 0;
    return fromSpend;
  }, [loyaltyCfg, bonusCreditLive, bonusPerEuroLive, visitTicketEuros, earnCredit.points]);

  const pointsEarnVisitReady = useMemo(() => {
    if (!loyaltyCfg || loyaltyCfg.mode !== 'points') return true;
    if (!(loyaltyCfg.pointsPerEuro > 0)) return false;
    return parseTicketEurosStrict(visitTicketEuros) != null;
  }, [loyaltyCfg, visitTicketEuros]);

  /** Tampons sur « Achat » : montant TTC × taux (arrondi sup.) + bonus + forfait visite si configuré. */
  const earnStampsTotalPreview = useMemo(() => {
    if (!loyaltyCfg || loyaltyCfg.mode !== 'stamps') return earnCredit.stamps;
    const spe = loyaltyCfg.stampsPerEuro;
    if (!(spe > 0)) return earnCredit.stamps;
    const gross = parseTicketEurosStrict(visitTicketEuros);
    if (gross == null) return 0;
    const addSe = bonusPerEuroLive ? Math.max(0, Number(loyaltyCfg.bonus.stampsExtraPerEuro) || 0) : 0;
    const legacyFlat =
      bonusCreditLive && addSe <= 0 ? Math.max(0, loyaltyCfg.bonus.stampsExtraPerVisit) : 0;
    const effSpe = spe + Math.max(0, addSe);
    const fromSpend = Math.ceil(gross * effSpe);
    const flat = Math.max(0, Math.min(10_000, Math.floor(loyaltyCfg.stampsPerVisit)));
    return fromSpend + flat + legacyFlat;
  }, [loyaltyCfg, bonusCreditLive, bonusPerEuroLive, visitTicketEuros, earnCredit.stamps]);

  const stampsEarnVisitReady = useMemo(() => {
    if (!loyaltyCfg || loyaltyCfg.mode !== 'stamps') return true;
    if (!(loyaltyCfg.stampsPerEuro > 0)) return true;
    return parseTicketEurosStrict(visitTicketEuros) != null;
  }, [loyaltyCfg, visitTicketEuros]);

  const birthdayAnnivLines = useMemo(() => {
    if (!selected || !isBirthdayToday(selected.birth_date, merchantDisplayTz) || !birthdayOfferBoot?.hasReduction) {
      return null;
    }
    const o = birthdayOfferBoot;
    const reductionPhrase = formatReductionForMessage(
      o.discount_kind,
      o.discount_percent,
      o.discount_fixed_cents,
      locale
    );
    const main = t('birthdayMain', { reduction: reductionPhrase });
    const gross = parseTicketEurosStrict(visitTicketEuros);
    if (gross == null) {
      return {
        main,
        after: t('birthdayAfterPrompt'),
      };
    }
    const afterEur = priceEurAfterBirthdayDiscount(gross, o);
    if (afterEur == null) return { main, after: null };
    return {
      main,
      after: t('birthdayAfterExample', {
        gross: gross.toLocaleString(intlTag, { style: 'currency', currency: 'EUR' }),
        after: afterEur.toLocaleString(intlTag, { style: 'currency', currency: 'EUR' }),
      }),
    };
  }, [selected, birthdayOfferBoot, visitTicketEuros, t, intlTag, locale, merchantDisplayTz]);

  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(
    null
  );

  useEffect(() => {
    if (!effectiveUnlocked) return;
    const supabase = createClient();
    let cancelled = false;

    void supabase.auth
      .getUser()
      .then(({ data: { user }, error }) => {
        if (cancelled || error || !user) return;
        const channel = supabase
          .channel(`banano-loyalty-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            () => {
              void loadBootstrap();
            }
          )
          .subscribe();
        realtimeChannelRef.current = channel;
      })
      .catch(() => {
        /* Hors ligne ou Supabase injoignable : pas de realtime, le terminal reste utilisable via l’API REST. */
      });

    return () => {
      cancelled = true;
      const ch = realtimeChannelRef.current;
      realtimeChannelRef.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [effectiveUnlocked, loadBootstrap]);

  /** Realtime envoie souvent une ligne partielle : loadBootstrap recharge la config complète. */
  useEffect(() => {
    if (layoutVariant !== 'fullscreen' || !effectiveUnlocked) return;
    const id = window.setInterval(() => void loadBootstrap(), 45_000);
    return () => window.clearInterval(id);
  }, [layoutVariant, effectiveUnlocked, loadBootstrap]);

  /** Évite la mise en veille de l’écran sur tablette / caisse (API Wake Lock). */
  useEffect(() => {
    if (layoutVariant !== 'fullscreen' || !staffSession) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* ignoré (permissions, navigateur) */
      }
    };
    void request();
    const onVis = () => {
      void request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [layoutVariant, staffSession]);

  useEffect(() => {
    const q = loyaltySearchQueryFromFields(searchClientName, searchClientPhone);
    if (!effectiveUnlocked || !q) {
      setMembers([]);
      return;
    }
    const debounceTimer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/banano/loyalty/members?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { members?: Member[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? t('errSearch'));
        setMembers(data.members ?? []);
      } catch {
        setMembers([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => clearTimeout(debounceTimer);
  }, [searchClientName, searchClientPhone, effectiveUnlocked, t]);

  useEffect(() => {
    if (!selected?.id) {
      setTimelineDetail(null);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id || (loyaltyCfg?.mode !== 'points' && loyaltyCfg?.mode !== 'stamps')) {
      setMemberVouchers([]);
      return;
    }
    void loadMemberVouchers(selected.id);
  }, [selected?.id, loyaltyCfg?.mode, loadMemberVouchers]);

  useEffect(() => {
    setTerminalVoucherFocus(null);
    setVoucherRedeemInput('');
  }, [selected?.id]);

  useEffect(() => {
    if (!effectiveUnlocked || !selected?.id) {
      setClientTimeline([]);
      return;
    }
    let cancelled = false;
    setClientTimelineLoading(true);
    void fetch(`/api/banano/crm/members/${selected.id}/timeline`)
      .then((r) => r.json())
      .then((data: { items?: TimelineItem[] }) => {
        if (cancelled) return;
        const raw = data.items ?? [];
        const normalized = raw.map((it) =>
          it.detail
            ? it
            : {
                ...it,
                detail: { title: it.label, rows: [{ label: t('timelineSummary'), value: it.label }] },
              }
        );
        setClientTimeline(normalized.slice(0, 20));
      })
      .catch(() => {
        if (!cancelled) setClientTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setClientTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, effectiveUnlocked, timelineVersion, t]);

  async function submitSetPin() {
    if (pinA.length < 4 || pinA !== pinB) {
      toast.error(t('toastPinMismatch'));
      return;
    }
    setPinBusy(true);
    try {
      const res = await fetch('/api/banano/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', pin: pinA }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errFail'));
      toast.success(t('toastPinSaved'));
      setBoot((b) => (b ? { ...b, pinConfigured: true } : b));
      setPinA('');
      setPinB('');
      persistMerchantPinUnlocked();
      setUnlocked(true);
    } catch (e) {
      setPinA('');
      setPinB('');
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setPinBusy(false);
    }
  }

  async function submitUnlock() {
    setPinBusy(true);
    try {
      const res = await fetch('/api/banano/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: unlockPin }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('toastWrongPin'));
      persistMerchantPinUnlocked();
      setUnlocked(true);
      setUnlockPin('');
      toast.success(t('toastUnlocked'));
    } catch (e) {
      setUnlockPin('');
      toast.error(e instanceof Error ? e.message : t('toastWrongPin'));
    } finally {
      setPinBusy(false);
    }
  }

  function clearStaffSessionForSwitch() {
    setStaffSession(null);
    setStaffPickId(null);
    setStaffPinEntry('');
    clearPersistedStaffSession();
    toast.message(t('toastChooseStaff'));
  }

  async function submitStaffPin() {
    if (!staffPickId || staffPinEntry.length !== 4) {
      toast.error(t('toastStaffPinRequired'));
      return;
    }
    setStaffPinBusy(true);
    try {
      const res = await fetch('/api/banano/staff/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staffPickId, pin: staffPinEntry }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        staff?: { id: string; display_name: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('toastWrongPin'));
      if (!data.staff?.id || !data.staff.display_name) throw new Error(t('invalidStaffResponse'));
      const sess = { id: data.staff.id, displayName: data.staff.display_name };
      setStaffSession(sess);
      persistStaffSession(sess);
      setStaffPickId(null);
      setStaffPinEntry('');
      toast.success(t('toastHello', { name: sess.displayName }));
    } catch (e) {
      setStaffPinEntry('');
      setStaffPickId(null);
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setStaffPinBusy(false);
    }
  }

  async function createOrOpenMember() {
    if (!newPhone.trim()) {
      toast.error(t('toastPhoneRequired'));
      return;
    }
    if (!isValidPhoneNumber(newPhone)) {
      toast.error(t('toastPhoneInvalid'));
      return;
    }
    if (!newName.trim()) {
      toast.error(t('toastNameOrder'));
      return;
    }
    setCreateBusy(true);
    try {
      const memberPayload: Record<string, unknown> = {
        phone: newPhone.trim(),
        display_name: newName.trim(),
      };
      if (layoutVariant === 'fullscreen' && staffSession) {
        memberPayload.created_by_staff_id = staffSession.id;
      }
      const res = await fetch('/api/banano/loyalty/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberPayload),
      });
      const data = (await res.json()) as { member?: Member; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.member) {
        setSelected(data.member);
        setSearchClientName('');
        setSearchClientPhone('');
        setMembers([]);
        setNewPhone('');
        setNewName('');
        setNewAddressLine('');
        setNewCity('');
        setNewPostal('');
        setNewCountry('');
        toast.success(t('toastMemberReady'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setCreateBusy(false);
    }
  }

  function openVoucherRedeemModal(row: TerminalVoucherRow) {
    if (!selected) return;
    const isStaff = row.voucher_class === 'staff_allowance';
    const remaining = Math.max(0, Math.floor(Number(row.remaining_euro_cents ?? 0)));
    if (isStaff) {
      if (remaining < 1) {
        toast.error(t('toastStaffVoucherEmpty'));
        return;
      }
      const ticketGross = parseTicketEurosStrict(visitTicketEuros);
      const ticketCents =
        ticketGross != null && ticketGross > 0 ? Math.round(ticketGross * 100) : null;
      const cappedTicket =
        ticketCents != null ? Math.min(Math.max(0, ticketCents), remaining) : null;
      const suggested =
        cappedTicket != null && cappedTicket >= 1 ? cappedTicket : remaining;
      const sug = Math.max(1, Math.min(suggested, remaining));
      setStaffVoucherDebitEuros(
        sug % 100 === 0 ? String(sug / 100) : (sug / 100).toFixed(2).replace('.', ',')
      );
      setVoucherRedeemModal({
        code: row.public_code,
        kind: 'staff_allowance',
        remainingCents: remaining,
        suggestedDebitCents: sug,
      });
    } else {
      setVoucherRedeemModal({
        code: row.public_code,
        kind: 'loyalty_one_shot',
        remainingCents: 0,
        suggestedDebitCents: 0,
      });
    }
  }

  function terminalVoucherEncaissementSection() {
    if (!selected || !loyaltyCfg) return null;
    if (loyaltyCfg.mode !== 'points' && loyaltyCfg.mode !== 'stamps') return null;
    return (
      <div
        className={`rounded-2xl border-2 p-3 space-y-3 transition-colors ${
          availableTerminalVouchers.length > 0
            ? 'border-emerald-500/70 dark:border-emerald-500/55 bg-emerald-50/65 dark:bg-emerald-950/35 animate-banano-voucher-attn'
            : 'border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20'
        }`}
      >
        <p className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
          <Gift className="w-4 h-4 shrink-0" />
          {t('vouchersSectionTitle')}
        </p>
        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
          {t('vouchersSectionHint')}
        </p>
        {memberVouchersLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('loadingShort')}
          </div>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-0.5">
            {memberVouchers.filter((x) => x.status === 'available').length === 0 ? (
              <p className="text-xs text-slate-500">{t('voucherNoActive')}</p>
            ) : (
              memberVouchers
                .filter((x) => x.status === 'available')
                .map((v) => (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setTerminalVoucherFocus(v.public_code);
                      setVoucherRedeemInput(v.public_code);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setTerminalVoucherFocus(v.public_code);
                        setVoucherRedeemInput(v.public_code);
                      }
                    }}
                    className={`rounded-xl border bg-white/90 dark:bg-zinc-900/60 p-2.5 flex gap-3 cursor-pointer touch-manipulation transition-shadow ${
                      terminalVoucherFocus === v.public_code
                        ? 'border-[#2563eb] ring-2 ring-[#2563eb]/50 shadow-md'
                        : 'border-white/60 dark:border-zinc-700'
                    }`}
                  >
                    <Image
                      src={`/api/banano/loyalty/vouchers/qr?code=${encodeURIComponent(v.public_code)}`}
                      alt=""
                      width={88}
                      height={88}
                      className="shrink-0 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white pointer-events-none"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50 break-all">
                        {v.public_code}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">{v.rewardLine}</p>
                      {v.voucher_class === 'staff_allowance' &&
                      typeof v.remaining_euro_cents === 'number' &&
                      v.remaining_euro_cents >= 0 ? (
                        <p className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                          {(() => {
                            const rem = Math.max(0, Math.floor(v.remaining_euro_cents));
                            const issued = staffVoucherIssuedCents(v);
                            const partial = issued > 0 && rem > 0 && rem < issued;
                            const fmt = (c: number) =>
                              (c / 100).toLocaleString(intlTag, {
                                minimumFractionDigits: c % 100 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              });
                            return partial ? (
                              <>{t('voucherPartialUse', { rem: fmt(rem), issued: fmt(issued) })}</>
                            ) : (
                              <>{t('voucherBalanceOnly', { amount: fmt(rem) })}</>
                            );
                          })()}
                        </p>
                      ) : null}
                      {v.expires_at ? (
                        <p className="text-[10px] text-amber-800 dark:text-amber-200 font-medium">
                          {t('voucherExpiresBefore', {
                            date: formatMerchantDt(v.expires_at, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500">{t('voucherNoExpiry')}</p>
                      )}
                      <div className="flex flex-col gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(v.public_code);
                            toast.message(t('toastCodeCopied'));
                          }}
                          className="inline-flex items-center justify-center gap-1 text-[11px] font-medium text-[#2563eb] hover:underline"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {t('copyCodeButton')}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVoucherRedeemModal(v);
                          }}
                          disabled={voucherRedeemBusy || transBusy}
                          className="w-full min-h-[40px] rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-45"
                        >
                          {t('encaisserCeBon')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={voucherRedeemInput}
            onChange={(e) => setVoucherRedeemInput(e.target.value.toUpperCase())}
            placeholder={t('placeholderVoucherInput')}
            autoCapitalize="characters"
            className="w-full min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base font-mono touch-manipulation"
          />
          <button
            type="button"
            disabled={voucherRedeemBusy || transBusy}
            onClick={() => {
              const c = voucherRedeemInput.trim().toUpperCase();
              if (c.length < 8) {
                toast.error(t('toastVoucherCodeRequired'));
                return;
              }
              const row = memberVouchers.find((x) => x.public_code === c);
              if (row) openVoucherRedeemModal(row);
              else
                setVoucherRedeemModal({
                  code: c,
                  kind: 'loyalty_one_shot',
                  remainingCents: 0,
                  suggestedDebitCents: 0,
                });
            }}
            className="w-full min-h-[48px] rounded-2xl bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-700 disabled:opacity-45 touch-manipulation active:scale-[0.99]"
          >
            {voucherRedeemBusy ? (
              <span className="inline-flex items-center gap-2 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('validating')}
              </span>
            ) : (
              t('validateBonCaisse')
            )}
          </button>
        </div>
      </div>
    );
  }

  async function redeemTerminalVoucher(codeArg?: string, debitEuroCents?: number) {
    if (!selected || !loyaltyCfg) return;
    if (loyaltyCfg.mode !== 'points' && loyaltyCfg.mode !== 'stamps') return;
    const code = (codeArg ?? voucherRedeemInput).trim().toUpperCase();
    if (code.length < 8) {
      toast.error(t('toastVoucherCodeRequired'));
      return;
    }
    const idempotencyKey = crypto.randomUUID();
    const memberLabel =
      formatTerminalClientName(selected.display_name).trim() || selected.phone_e164 || selected.id;
    const staffId = layoutVariant === 'fullscreen' && staffSession ? staffSession.id : undefined;

    const tryEnqueueRedeem = (err: unknown, res: Response | null) => {
      if (!shouldEnqueueOfflineRetry(err, res)) return false;
      enqueueOfflineItem({
        idempotencyKey,
        op: 'voucher_redeem',
        memberId: selected.id,
        memberLabel,
        code,
        staffId,
        debitEuroCents:
          typeof debitEuroCents === 'number' && debitEuroCents >= 1 ? debitEuroCents : undefined,
        createdAt: new Date().toISOString(),
      });
      setOfflineQueue(loadOfflineQueue());
      toast.message(t('toastNetworkVoucherQueue'));
      return true;
    };

    setVoucherRedeemBusy(true);
    try {
      const body: Record<string, unknown> = {
        code,
        memberId: selected.id,
        idempotencyKey,
      };
      if (typeof debitEuroCents === 'number' && debitEuroCents >= 1) {
        body.debitEuroCents = debitEuroCents;
      }
      if (staffId) body.staffId = staffId;

      let res: Response;
      try {
        res = await fetch('/api/banano/loyalty/vouchers/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (tryEnqueueRedeem(e, null)) return;
        toast.error(e instanceof Error ? e.message : t('toastNetworkError'));
        return;
      }

      let data: {
        rewardLine?: string;
        error?: string;
        voucherClass?: string;
        appliedEurosFormatted?: string;
        remainingEurosFormatted?: string;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        if (tryEnqueueRedeem(null, res)) return;
        toast.error(data.error ?? t('toastValidateFail'));
        return;
      }

      if (data.voucherClass === 'staff_allowance' && data.appliedEurosFormatted) {
        toast.success(
          data.remainingEurosFormatted
            ? t('toastStaffDebitWithRemaining', {
                applied: data.appliedEurosFormatted,
                remaining: data.remainingEurosFormatted,
              })
            : t('toastStaffDebitApplied', { applied: data.appliedEurosFormatted })
        );
      } else {
        toast.success(t('toastVoucherOk', { line: data.rewardLine ?? '' }));
      }
      setVoucherRedeemInput('');
      setTerminalVoucherFocus(null);
      setVoucherRedeemModal(null);
      void loadMemberVouchers(selected.id);
      setTimelineVersion((v) => v + 1);
      if (data.voucherClass === 'staff_allowance') {
        dispatchBananoStaffAllowanceSync({ source: 'terminal' });
      }
    } finally {
      setVoucherRedeemBusy(false);
    }
  }

  function confirmVoucherRedeemFromModal() {
    if (!voucherRedeemModal || !selected) return;
    if (voucherRedeemModal.kind === 'loyalty_one_shot') {
      void redeemTerminalVoucher(voucherRedeemModal.code);
      return;
    }
    const raw = staffVoucherDebitEuros.trim().replace(/\s/g, '').replace(',', '.');
    const euros = parseFloat(raw);
    if (!Number.isFinite(euros) || euros <= 0) {
      toast.error(t('toastAmountStaffVoucher'));
      return;
    }
    const cents = Math.round(euros * 100);
    if (cents < 1 || cents > voucherRedeemModal.remainingCents) {
      const minEur = (0.01).toLocaleString(intlTag, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const maxEur = (voucherRedeemModal.remainingCents / 100).toLocaleString(intlTag, {
        minimumFractionDigits: voucherRedeemModal.remainingCents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
        style: 'currency',
        currency: 'EUR',
      });
      toast.error(t('toastStaffDebitRange', { min: minEur, max: maxEur }));
      return;
    }
    void redeemTerminalVoucher(voucherRedeemModal.code, cents);
  }

  async function transact(kind: 'earn_visit' | 'redeem_reward' | 'redeem_points') {
    if (!selected) return;
    if (kind === 'earn_visit' && loyaltyCfg) {
      const gross = parseTicketEurosStrict(visitTicketEuros);
      if (loyaltyCfg.mode === 'points' && loyaltyCfg.pointsPerEuro > 0 && gross == null) {
        toast.error(t('toastTicketPoints'));
        return;
      }
      if (loyaltyCfg.mode === 'stamps' && loyaltyCfg.stampsPerEuro > 0 && gross == null) {
        toast.error(t('toastTicketStamps'));
        return;
      }
    }
    const body: Record<string, unknown> = { memberId: selected.id, kind };
    if (kind === 'earn_visit') {
      const n = visitNote.trim();
      if (n) body.note = n.slice(0, 500);
      const te = visitTicketEuros.trim().replace(',', '.');
      if (te) {
        const x = parseFloat(te);
        if (Number.isFinite(x) && x > 0 && x <= 100000) {
          body.ticketAmountCents = Math.round(x * 100);
        }
      }
      const icRaw = visitItemsCount.trim();
      if (icRaw) {
        const ic = parseInt(icRaw, 10);
        if (!Number.isNaN(ic) && ic > 0 && ic <= 100000) {
          body.ticketItemsCount = ic;
        }
      }
    }
    if (kind === 'redeem_reward') {
      if (!loyaltyCfg) return;
      body.note = activeLoyaltyProgram(loyaltyCfg).rewardText;
    }
    if (kind === 'redeem_points') {
      const n = parseInt(redeemPts.trim(), 10);
      if (Number.isNaN(n) || n < 1) {
        toast.error(t('toastPointsInvalid'));
        return;
      }
      body.amount = n;
    }
    if (layoutVariant === 'fullscreen' && staffSession) {
      body.staffId = staffSession.id;
    }
    const tid = terminalRegisterId.trim().slice(0, 64);
    if (tid) body.terminalId = tid;

    const idempotencyKey = crypto.randomUUID();
    body.idempotencyKey = idempotencyKey;
    const memberLabel =
      formatTerminalClientName(selected.display_name).trim() || selected.phone_e164 || selected.id;

    const buildOfflinePayload = (): OfflineTransactPayload | null => {
      if (kind !== 'earn_visit' && kind !== 'redeem_points') return null;
      const p: OfflineTransactPayload = {
        memberId: selected.id,
        kind,
      };
      if (kind === 'earn_visit') {
        const n = visitNote.trim();
        if (n) p.note = n.slice(0, 500);
        const te = visitTicketEuros.trim().replace(',', '.');
        if (te) {
          const x = parseFloat(te);
          if (Number.isFinite(x) && x > 0 && x <= 100000) {
            p.ticketAmountCents = Math.round(x * 100);
          }
        }
        const icRaw = visitItemsCount.trim();
        if (icRaw) {
          const ic = parseInt(icRaw, 10);
          if (!Number.isNaN(ic) && ic > 0 && ic <= 100000) {
            p.ticketItemsCount = ic;
          }
        }
      }
      if (kind === 'redeem_points') {
        const n = parseInt(redeemPts.trim(), 10);
        if (!Number.isNaN(n) && n >= 1) p.amount = n;
      }
      if (layoutVariant === 'fullscreen' && staffSession) p.staffId = staffSession.id;
      const reg = terminalRegisterId.trim().slice(0, 64);
      if (reg) p.terminalId = reg;
      return p;
    };

    const tryEnqueueTransact = (err: unknown, res: Response | null) => {
      const payload = buildOfflinePayload();
      if (!payload || !shouldEnqueueOfflineRetry(err, res)) return false;
      enqueueOfflineItem({
        idempotencyKey,
        op: 'transact',
        memberId: selected.id,
        memberLabel,
        payload,
        createdAt: new Date().toISOString(),
      });
      setOfflineQueue(loadOfflineQueue());
      toast.message(t('toastOfflineLoyaltyQueue'));
      return true;
    };

    setTransBusy(true);
    try {
      let res: Response;
      try {
        res = await fetch('/api/banano/loyalty/transact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (tryEnqueueTransact(e, null)) return;
        toast.error(e instanceof Error ? e.message : t('toastNetworkError'));
        return;
      }

      let data: {
        member?: Member;
        error?: string;
        vouchersIssued?: { code: string; rewardLine: string }[];
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        data = {};
      }

      if (!res.ok) {
        if (tryEnqueueTransact(null, res)) return;
        toast.error(data.error ?? t('toastOpFail'));
        return;
      }

      if (data.member) setSelected(data.member);
      setRedeemPts('');
      if (kind === 'earn_visit') {
        setVisitNote('');
        setVisitTicketEuros('');
        setVisitItemsCount('');
        playEarnCreditFeedback();
        if (data.vouchersIssued?.length) {
          const list = data.vouchersIssued;
          toast.success(
            list.length === 1
              ? t('toastBonCreated', { code: list[0]!.code, line: list[0]!.rewardLine })
              : t('toastBonsCreated', {
                  count: list.length,
                  codes: list.map((v) => v.code).join(', '),
                })
          );
          void loadMemberVouchers(selected.id);
          setTimelineVersion((v) => v + 1);
        } else {
          toast.success(t('toastOpSaved'));
        }
      } else {
        toast.success(t('toastOpSaved'));
      }
    } finally {
      setTransBusy(false);
    }
  }

  function openMemberEditor() {
    if (!selected) return;
    const ln = (selected.last_name ?? '').trim();
    const fn = (selected.first_name ?? '').trim();
    const split = splitDisplayForEdit(selected.display_name);
    setEditLast(ln || split.last);
    setEditFirst(fn || split.first);
    setEditPhone(selected.phone_e164 ?? '');
    setEditBirth(
      selected.birth_date && typeof selected.birth_date === 'string'
        ? selected.birth_date.slice(0, 10)
        : ''
    );
    setEditAddressLine((selected.address_line ?? '').trim());
    setEditCity((selected.city ?? '').trim());
    setEditPostal((selected.postal_code ?? '').trim());
    setEditCountry((selected.country ?? '').trim());
    setEditOpen(true);
  }

  async function saveMemberEditsTerminal() {
    if (!selected) return;
    if (!isValidPhoneNumber(editPhone)) {
      toast.error(t('toastPhoneInvalid'));
      return;
    }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/banano/loyalty/members/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_name: editLast.trim(),
          first_name: editFirst.trim(),
          phone: editPhone.trim(),
          birth_date: editBirth.trim() === '' ? null : editBirth.trim(),
          address_line: editAddressLine.trim() || null,
          city: editCity.trim() || null,
          postal_code: editPostal.trim() || null,
          country: editCountry.trim() || null,
        }),
      });
      const data = (await res.json()) as { member?: Member; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errUpdate'));
      if (data.member) setSelected(data.member);
      setEditOpen(false);
      toast.success(t('toastMemberUpdated'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setEditBusy(false);
    }
  }

  if (bootErr) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 text-sm text-red-800 dark:text-red-200">
        {bootErr}
      </div>
    );
  }

  if (!boot || !loyaltyCfg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">{t('loadingTerminal')}</p>
      </div>
    );
  }

  if (pinGateActive && !unlocked) {
    if (!boot.pinConfigured) {
      return (
        <div className="max-w-md mx-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-lg p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb]/10 text-[#2563eb]">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t('pinFirstTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t('pinFirstHint')}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('pinEntry1')}</p>
            <PinPad value={pinA} onChange={setPinA} maxLen={8} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t('pinConfirm')}</p>
            <PinPad value={pinB} onChange={setPinB} maxLen={8} />
          </div>
          <button
            type="button"
            onClick={() => void submitSetPin()}
            disabled={pinBusy || pinA.length < 4}
            className="w-full py-4 rounded-2xl bg-[#2563eb] text-white font-semibold text-base hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pinBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {t('pinSaveOpen')}
          </button>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-lg p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Smartphone className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t('terminalBananoTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pinSessionHint')}</p>
        </div>
        <PinPad value={unlockPin} onChange={setUnlockPin} maxLen={8} />
        <button
          type="button"
          onClick={() => void submitUnlock()}
          disabled={pinBusy || unlockPin.length < 4}
          className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-base hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {pinBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
          {t('unlock')}
        </button>
      </div>
    );
  }

  const staffGateRequired =
    layoutVariant === 'fullscreen' && activeTerminalStaff.length > 0 && !staffSession;

  if (staffGateRequired) {
    const picked = staffPickId
      ? activeTerminalStaff.find((s) => s.id === staffPickId)
      : null;
    return (
      <div className="max-w-lg mx-auto rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] shadow-lg p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563eb]/10 text-[#2563eb]">
            <UserRound className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t('staffWhoTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('staffHint')}</p>
        </div>
        {!staffPickId ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activeTerminalStaff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStaffPickId(s.id);
                    setStaffPinEntry('');
                  }}
                  className="min-h-[56px] rounded-2xl border-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/80 text-base font-bold text-slate-900 dark:text-slate-50 hover:border-[#2563eb] dark:hover:border-[#2563eb] hover:bg-[#2563eb]/5 transition-colors touch-manipulation active:scale-[0.99]"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setStaffPickId(null);
                setStaffPinEntry('');
              }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#2563eb] touch-manipulation"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('otherStaff')}
            </button>
            <p className="text-center text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('staffCodeFor', { name: picked?.display_name ?? '' })}
            </p>
            <PinPad value={staffPinEntry} onChange={setStaffPinEntry} maxLen={4} />
            <button
              type="button"
              onClick={() => void submitStaffPin()}
              disabled={staffPinBusy || staffPinEntry.length !== 4}
              className="w-full py-4 rounded-2xl bg-[#2563eb] text-white font-semibold text-base hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {staffPinBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {t('openTerminal')}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (layoutVariant === 'fullscreen' && employeePrivacyLock) {
    return (
      <div className="flex min-h-[min(70vh,520px)] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-8 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{t('privacyTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{t('privacyHint')}</p>
        </div>
        <button
          type="button"
          onClick={() => setEmployeePrivacyLock(false)}
          className="min-h-[48px] px-8 rounded-2xl bg-[#2563eb] text-white font-semibold text-base hover:bg-[#1d4ed8]"
        >
          {t('unlock')}
        </button>
      </div>
    );
  }

  const cfg = loyaltyCfg;

  return (
    <div
      className={`space-y-6 sm:space-y-8 w-full min-w-0 ${layoutVariant === 'fullscreen' ? 'touch-pan-y pb-4' : 'pb-8 sm:pb-14'}`}
    >
      {layoutVariant === 'fullscreen' && cfg ? (
        <div
          className="sticky z-[70] flex flex-col gap-2.5 rounded-2xl border border-slate-200/90 dark:border-zinc-700/90 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3"
          style={{
            top: 'max(0.25rem, env(safe-area-inset-top, 0px))',
          }}
        >
          <div className="order-2 flex min-w-0 flex-1 items-center gap-2.5 sm:order-1 sm:justify-start">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/12 text-[#2563eb] dark:bg-[#2563eb]/20 dark:text-sky-300"
              aria-hidden
            >
              <MonitorSmartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:flex-none sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('labelEstablishment')}
              </p>
              <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-50 sm:text-base">
                {establishmentName ?? t('establishmentFallback')}
              </p>
            </div>
          </div>
          <div className="order-1 flex w-full items-center justify-between gap-2 border-b border-slate-200/80 pb-2 dark:border-zinc-800/80 sm:order-2 sm:w-auto sm:justify-end sm:border-0 sm:pb-0">
            <div className="flex justify-center sm:justify-end">
              <ThemeToggle />
            </div>
            <button
              type="button"
              onClick={lockTerminal}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-600 bg-slate-50 px-3 text-sm font-semibold text-slate-800 dark:bg-zinc-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-800 sm:flex-initial sm:px-4 touch-manipulation active:scale-[0.99]"
              aria-label={t('lockAria')}
            >
              <Lock className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span>{t('lock')}</span>
            </button>
          </div>
        </div>
      ) : null}
      {(offlineQueue.length > 0 || !networkOnline) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm space-y-3 shadow-sm ${
            offlineQueueHasStale
              ? 'border-red-400/90 dark:border-red-800/70 bg-red-50/95 dark:bg-red-950/40'
              : 'border-amber-300/80 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/35'
          }`}
        >
          <div className="flex flex-wrap items-start gap-3">
            {offlineQueueHasStale ? (
              <AlertTriangle
                className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                aria-hidden
              />
            ) : (
              <WifiOff className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden />
            )}
            <div className="flex-1 min-w-[200px] space-y-1">
              <p
                className={`font-bold ${
                  offlineQueueHasStale
                    ? 'text-red-950 dark:text-red-100'
                    : 'text-amber-950 dark:text-amber-100'
                }`}
              >
                {t('degradedTitle')}
              </p>
              <p
                className={`text-xs leading-snug ${
                  offlineQueueHasStale
                    ? 'text-red-900/95 dark:text-red-200/90'
                    : 'text-amber-900/90 dark:text-amber-200/90'
                }`}
              >
                {!networkOnline
                  ? t('degradedOffline')
                  : offlineQueue.length > 0
                    ? t('degradedPending', { count: offlineQueue.length })
                    : null}
              </p>
              {offlineQueueHasStale ? (
                <p className="text-xs font-semibold text-red-800 dark:text-red-200/95 flex items-start gap-1.5 pt-0.5">
                  <span className="inline-block mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" aria-hidden />
                  {t('degradedStale')}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={offlineSyncBusy || offlineQueue.length === 0 || !networkOnline}
              onClick={() => void flushOfflineQueue()}
              className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold disabled:opacity-45 touch-manipulation active:scale-[0.99] ${
                offlineQueueHasStale
                  ? 'border-red-400/90 dark:border-red-700 bg-white/95 dark:bg-red-950/50 text-red-950 dark:text-red-50 hover:bg-red-100/90 dark:hover:bg-red-900/35'
                  : 'border-amber-400/90 dark:border-amber-700 bg-white/90 dark:bg-amber-950/50 text-amber-950 dark:text-amber-50 hover:bg-amber-100/90 dark:hover:bg-amber-900/40'
              }`}
            >
              {offlineSyncBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              {t('sync')}
            </button>
          </div>
          {offlineQueue.length > 0 ? (
            <ul
              className={`space-y-2 text-xs border-t pt-3 ${
                offlineQueueHasStale
                  ? 'text-red-950 dark:text-red-100 border-red-200/80 dark:border-red-900/55'
                  : 'text-amber-950 dark:text-amber-100 border-amber-200/70 dark:border-amber-900/50'
              }`}
            >
              {offlineQueue.map((item) => (
                <li
                  key={item.idempotencyKey}
                  className={`flex flex-wrap items-start justify-between gap-2 rounded-lg px-2 py-1.5 ${
                    offlineQueueItemIsStale(item)
                      ? 'bg-red-100/80 dark:bg-red-950/45 ring-1 ring-red-300/70 dark:ring-red-800/60'
                      : 'bg-white/60 dark:bg-amber-950/25'
                  }`}
                >
                  <span className="min-w-0 break-words pr-1">
                    {formatOfflineItemLabel(item)}
                    {offlineQueueItemIsStale(item) ? (
                      <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                        {t('stalePending', { age: staleAgeLabel(item.createdAt) })}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className={`shrink-0 text-[11px] font-semibold underline underline-offset-2 ${
                      offlineQueueItemIsStale(item)
                        ? 'text-red-800 dark:text-red-300'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}
                    onClick={() => {
                      removeOfflineItemByKey(item.idempotencyKey);
                      setOfflineQueue(loadOfflineQueue());
                      toast.message(t('toastQueueRemoved'));
                    }}
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {!showMerchantLoyaltySettings && layoutVariant === 'dashboard' ? (
        <div className="rounded-xl border border-slate-200/90 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/50 px-4 py-3 space-y-2 mb-3">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
            {t('terminalRegisterLabel')}
          </label>
          <input
            type="text"
            value={terminalRegisterId}
            onChange={(e) => setTerminalRegisterId(e.target.value.slice(0, 64))}
            onBlur={() => {
              const v = terminalRegisterId.trim().slice(0, 64);
              setTerminalRegisterId(v);
              try {
                if (v) localStorage.setItem(TERMINAL_REGISTER_STORAGE_KEY, v);
                else localStorage.removeItem(TERMINAL_REGISTER_STORAGE_KEY);
              } catch {
                /* ignore */
              }
            }}
            placeholder={t('terminalRegisterPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-950 text-sm text-slate-900 dark:text-zinc-100"
          />
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{t('terminalRegisterHint')}</p>
        </div>
      ) : null}
      {!showMerchantLoyaltySettings && layoutVariant === 'dashboard' ? (
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 leading-snug">
          <strong>{t('settingsBanner')}</strong> {t('settingsBannerRest')}{' '}
          <Link
            href="/dashboard/whatsapp-review?tab=parametres"
            className="font-semibold text-[#2563eb] dark:text-sky-400 underline underline-offset-2"
          >
            {t('settingsLink')}
          </Link>{' '}
          {t('settingsBannerEnd')}
        </div>
      ) : null}
      {showMerchantLoyaltySettings && (
        <BananoLoyaltyMerchantSettings
          loyalty={cfg}
          onSaved={(next) => {
            setLoyaltyCfg(next);
          }}
          onRefreshBootstrap={loadBootstrap}
        />
      )}
      <div className="rounded-3xl border-2 border-[#2563eb]/25 dark:border-[#2563eb]/30 bg-gradient-to-b from-[#2563eb]/5 to-transparent dark:from-[#2563eb]/10 p-5 sm:p-7">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,min(420px,42vw))_1fr] gap-4 md:gap-5 md:items-stretch md:min-h-[calc(100dvh-8.75rem)]">
          <div className="flex flex-col gap-4 min-w-0 md:min-h-0 md:overflow-y-auto">
            <div className="flex flex-col gap-4 min-w-0">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-[#2563eb] mb-1">
                  {t('terminalModeTitle')}
                </p>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-50">
                  {t('fidelityClients')}
                </h2>
                {layoutVariant === 'fullscreen' && staffSession ? (
                  <div className="mt-2 space-y-2 rounded-xl border border-emerald-200/90 dark:border-emerald-900/50 bg-emerald-50/90 dark:bg-emerald-950/35 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs sm:text-sm font-semibold text-emerald-950 dark:text-emerald-100 min-w-0 flex-1 leading-snug">
                        {t('tillStaffLabel')}{' '}
                        <span className="font-bold text-emerald-900 dark:text-emerald-50">
                          {staffSession.displayName}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => clearStaffSessionForSwitch()}
                        className="shrink-0 min-h-[40px] px-3 rounded-lg border border-emerald-300 dark:border-emerald-800 text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-100 bg-white/80 dark:bg-emerald-950/50 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 touch-manipulation"
                      >
                        {t('changeStaffBtn')}
                      </button>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-emerald-900/90 dark:text-emerald-200/90 mb-1">
                        {t('terminalRegisterLabel')}
                      </label>
                      <input
                        type="text"
                        value={terminalRegisterId}
                        onChange={(e) => setTerminalRegisterId(e.target.value.slice(0, 64))}
                        onBlur={() => {
                          const v = terminalRegisterId.trim().slice(0, 64);
                          setTerminalRegisterId(v);
                          try {
                            if (v) localStorage.setItem(TERMINAL_REGISTER_STORAGE_KEY, v);
                            else localStorage.removeItem(TERMINAL_REGISTER_STORAGE_KEY);
                          } catch {
                            /* ignore */
                          }
                        }}
                        placeholder={t('terminalRegisterPlaceholder')}
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full min-h-[40px] px-2 rounded-lg border border-emerald-300/80 dark:border-emerald-800 bg-white/90 dark:bg-emerald-950/40 text-xs text-emerald-950 dark:text-emerald-50"
                      />
                    </div>
                  </div>
                ) : null}
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {layoutVariant === 'fullscreen' ? t('tabletFullscreenHint') : t('terminalSearchBlurb')}
                </p>
                {layoutVariant === 'fullscreen' ? (
                  <details className="mt-3 rounded-xl border border-sky-200/90 dark:border-sky-900/50 bg-sky-50/90 dark:bg-sky-950/30 text-xs text-sky-950 dark:text-sky-100 group">
                    <summary className="cursor-pointer list-none px-3 py-2 font-bold flex items-center justify-between gap-2 text-sky-900 dark:text-sky-50">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{t('terminalHelpLinkSummary')}</span>
                      </span>
                      <span className="text-[10px] font-normal text-sky-600 dark:text-sky-400 shrink-0 group-open:hidden">
                        {t('expand')}
                      </span>
                    </summary>
                    <div className="px-3 pb-3 pt-0 space-y-2 border-t border-sky-200/70 dark:border-sky-800/50 leading-relaxed">
                      <div>
                        <p className="font-bold text-sky-900 dark:text-sky-50">{t('terminalFsUniqueTitle')}</p>
                        <p className="mt-1 text-sky-900/95 dark:text-sky-100/95">{t('terminalFsUniqueBody')}</p>
                      </div>
                      <p className="font-bold text-sky-900 dark:text-sky-50 pt-0.5 border-t border-sky-200/70 dark:border-sky-800/50">
                        {t('terminalConventionTitle')}
                      </p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-sky-900/95 dark:text-sky-100/95">
                        <li>{t('terminalFsConv1')}</li>
                        <li>{t('terminalFsConv2')}</li>
                        <li>{t('terminalFsConv3')}</li>
                      </ul>
                    </div>
                  </details>
                ) : (
                  <div className="mt-4 rounded-xl border border-sky-200/90 dark:border-sky-900/50 bg-sky-50/90 dark:bg-sky-950/30 px-3 py-2.5 text-xs text-sky-950 dark:text-sky-100 leading-relaxed space-y-2">
                    <div>
                      <p className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-50">
                        <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                        {t('terminalDashUniqueTitle')}
                      </p>
                      <p className="mt-1 text-sky-900/95 dark:text-sky-100/95">{t('terminalDashUniqueBody')}</p>
                    </div>
                    <p className="font-bold flex items-center gap-1.5 text-sky-900 dark:text-sky-50 pt-0.5 border-t border-sky-200/70 dark:border-sky-800/50">
                      <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      {t('terminalDashConvTitle')}
                    </p>
                    <ul className="mt-1.5 list-disc pl-4 space-y-0.5 text-sky-900/95 dark:text-sky-100/95">
                      <li>{t('terminalDashConv1')}</li>
                      <li>{t('terminalDashConv2')}</li>
                      <li>{t('terminalDashConv3')}</li>
                    </ul>
                  </div>
                )}
                {layoutVariant === 'dashboard' ? (
                  <div className="mt-4 space-y-3">
                    <Link
                      href={terminalPathOnly}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors w-fit"
                    >
                      <MonitorSmartphone className="w-4 h-4 shrink-0" />
                      {t('openTerminalEmployee')}
                    </Link>
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/50 p-3 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t('copyLinkHeading')}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <input
                          readOnly
                          value={terminalAbsoluteUrl}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-mono text-slate-800 dark:text-slate-200"
                          onFocus={(e) => e.target.select()}
                          aria-label={t('terminalUrlAria')}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(terminalAbsoluteUrl).then(
                              () => toast.success(t('toastLinkCopied')),
                              () => toast.error(t('toastCopyFailed'))
                            );
                          }}
                          className="inline-flex items-center justify-center gap-2 min-h-[40px] shrink-0 px-4 rounded-lg text-sm font-semibold border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-zinc-700"
                        >
                          <Copy className="w-4 h-4" />
                          {t('copyLinkBtn')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 space-y-3 min-w-0 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Search className="w-4 h-4 text-[#2563eb] shrink-0" />
              {t('searchClient')}
            </div>

            <div className="space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t('labelNameCaisse')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {t('hintNameCaisse')}
                </span>
                <input
                  type="text"
                  name="banano-search-client-name"
                  autoComplete="off"
                  placeholder={t('placeholderNameEx')}
                  value={searchClientName}
                  onChange={(e) => setSearchClientName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-base text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t('labelPhone')}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('hintPhoneSearch')}
                </span>
                <PhoneInput
                  id="banano-search-client-phone"
                  value={searchClientPhone}
                  onChange={(v) => setSearchClientPhone(v ?? '')}
                  placeholder={t('phonePlaceholderExample')}
                  containerClassName="w-full"
                />
              </label>
            </div>
            {searching && (
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('searching')}
              </p>
            )}
            <ul className="max-h-[min(40vh,22rem)] overflow-auto divide-y divide-slate-100 dark:divide-zinc-800 rounded-xl border border-slate-100 dark:border-zinc-800">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(m);
                      setSearchClientName('');
                      setSearchClientPhone('');
                      setMembers([]);
                    }}
                    className="w-full text-left px-3 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/80 transition-colors"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100 inline-flex items-center gap-2 flex-wrap">
                      {m.display_name}
                      {isBirthdayToday(m.birth_date, merchantDisplayTz) ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
                          {t('annivBadge')}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs font-mono text-slate-500">{m.phone_e164}</span>
                  </button>
                </li>
              ))}
              {!searching &&
                loyaltySearchQueryFromFields(searchClientName, searchClientPhone) &&
                members.length === 0 && (
                  <li className="px-3 py-6 text-sm text-slate-400 text-center">{t('noResults')}</li>
                )}
            </ul>

            <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">{t('newClientUpper')}</p>
              <PhoneInput
                id="banano-new-client-phone"
                value={newPhone}
                onChange={(v) => setNewPhone(v ?? '')}
                placeholder={t('phonePlaceholderExample')}
                containerClassName="w-full"
              />
              <input
                type="text"
                placeholder={t('placeholderNewName')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                autoCapitalize="characters"
              />
              <details className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/30 text-left">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {t('addressOptionalSummary')}
                </summary>
                <div className="px-3 pb-3 pt-0 space-y-2">
                  <input
                    type="text"
                    placeholder={t('placeholderStreet')}
                    value={newAddressLine}
                    onChange={(e) => setNewAddressLine(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                    autoComplete="off"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={t('placeholderCp')}
                      value={newPostal}
                      onChange={(e) => setNewPostal(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                      autoComplete="off"
                    />
                    <input
                      type="text"
                      placeholder={t('placeholderCity')}
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder={t('placeholderCountry')}
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                    autoComplete="off"
                  />
                </div>
              </details>
              <button
                type="button"
                onClick={() => void createOrOpenMember()}
                disabled={createBusy}
                className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm"
              >
                {createBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('createOpenSheet')}
              </button>
            </div>
          </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col min-h-0 md:min-h-0 md:h-full md:overflow-y-auto">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 gap-3 py-8">
                <UserRound className="w-12 h-12 opacity-40" />
                <p className="text-sm">{t('selectClientPrompt')}</p>
              </div>
            ) : (
              <div className="space-y-5 flex-1 flex flex-col min-h-0">
                {isBirthdayToday(selected.birth_date, merchantDisplayTz) ? (
                  <div
                    className="rounded-2xl border-2 border-rose-300/90 dark:border-rose-700/80 bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 text-white p-4 sm:p-5 text-center shadow-lg shadow-rose-500/20 space-y-2"
                    role="status"
                  >
                    <Cake className="w-9 h-9 mx-auto mb-1 opacity-95 drop-shadow-sm" aria-hidden />
                    <p className="text-lg sm:text-xl font-extrabold tracking-tight">{t('happyBirthday')}</p>
                    <p className="text-sm font-medium opacity-95">{selected.display_name}</p>
                    {birthdayAnnivLines ? (
                      <>
                        <p className="text-sm font-semibold leading-snug bg-white/15 rounded-xl px-3 py-2">
                          {birthdayAnnivLines.main}
                        </p>
                        {birthdayAnnivLines.after ? (
                          <p className="text-xs font-medium opacity-95 leading-snug">{birthdayAnnivLines.after}</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm font-medium opacity-95">{t('birthdayFallbackLine')}</p>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
                      {selected.crm_role === 'staff' ? t('roleClientStaff') : t('roleClient')}
                    </p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-50">{selected.display_name}</p>
                    <p className="font-mono text-sm text-slate-500">{selected.phone_e164}</p>
                    {selected.preferred_locale ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {t('langEstimated')}{' '}
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          {PREFERRED_LOCALE_LABEL[selected.preferred_locale] ?? selected.preferred_locale.toUpperCase()}
                        </span>
                      </p>
                    ) : null}
                    {selected.birth_date && !isBirthdayToday(selected.birth_date, merchantDisplayTz) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <Cake className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                        {t('birthdayDatePrefix')}{' '}
                        {(() => {
                          try {
                            return new Date(`${selected.birth_date.slice(0, 10)}T12:00:00`).toLocaleDateString(
                              intlTag,
                              INTL_BIRTHDAY_DAY_MONTH
                            );
                          } catch {
                            return selected.birth_date;
                          }
                        })()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openMemberEditor()}
                      className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-zinc-800 w-full sm:w-auto touch-manipulation active:scale-[0.99]"
                    >
                      <Pencil className="w-4 h-4 shrink-0" />
                      {t('editMember')}
                    </button>
                    {layoutVariant !== 'fullscreen' ? (
                      <Link
                        href={`/dashboard/whatsapp-review?tab=clients&member=${selected.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-2 rounded-xl text-sm font-semibold text-[#2563eb] border border-[#2563eb]/40 bg-[#2563eb]/5 hover:bg-[#2563eb]/10 w-full sm:w-auto touch-manipulation"
                      >
                        <History className="w-4 h-4 shrink-0" />
                        {t('baseClientsDetail')}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <details className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/60 dark:bg-zinc-900/40 text-left group">
                      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>{t('timelinePreviewTitle')}</span>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform">
                          {TIMELINE_DETAILS_CHEVRON}
                        </span>
                      </summary>
                      <div className="px-3 pb-3 pt-0 max-h-56 overflow-y-auto space-y-1.5 border-t border-slate-200 dark:border-zinc-700">
                        {clientTimelineLoading ? (
                          <p className="text-xs text-slate-500 flex items-center gap-2 py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('loadingShort')}
                          </p>
                        ) : clientTimeline.length === 0 ? (
                          <p className="text-xs text-slate-500 py-2">
                            {t('timelineEmpty')}
                          </p>
                        ) : (
                          clientTimeline.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => setTimelineDetail(it)}
                              className={`w-full text-left text-[11px] leading-snug rounded-lg px-2 py-1.5 transition-opacity hover:opacity-90 ${
                                it.kind === 'review'
                                  ? 'bg-amber-100/80 dark:bg-amber-950/40'
                                  : 'bg-white dark:bg-zinc-950'
                              }`}
                            >
                              {it.label}
                              <span className="block text-[10px] text-slate-400 mt-0.5 tabular-nums">
                                {formatMerchantDt(it.at, MERCHANT_TIMELINE_DT_OPTS)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </details>
                  </div>
                </div>

                {cfg.mode === 'points' ? (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 p-4 sm:p-5 text-center">
                    <Star className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                    <p className="text-3xl sm:text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {selected.points_balance}
                    </p>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide mt-1">
                      {t('pointsWord')}
                    </p>
                  </div>
                ) : null}
                {(cfg.mode === 'points' || cfg.mode === 'stamps') &&
                selected &&
                !memberVouchersLoading &&
                availableTerminalVouchers.length > 0 ? (
                  <div
                    className="animate-banano-voucher-attn rounded-2xl border-2 border-emerald-500/75 dark:border-emerald-400/50 bg-gradient-to-br from-emerald-50 via-white to-teal-50/90 dark:from-emerald-950/55 dark:via-zinc-900/80 dark:to-teal-950/40 px-4 py-3 shadow-md shadow-emerald-500/10"
                    role="status"
                  >
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 text-center">
                      {t('voucherAtTillTitle')}
                    </p>
                    <p className="text-[11px] text-emerald-800/95 dark:text-emerald-200/90 text-center mt-1 leading-snug">
                      {t('voucherAtTillSub', { count: availableTerminalVouchers.length })}
                    </p>
                  </div>
                ) : null}
                {cfg.mode === 'stamps' ? (
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 p-4 sm:p-5 text-center">
                    <Gift className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                    <p className="text-3xl sm:text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                      {selected.stamps_balance}
                    </p>
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide mt-1">
                      {t('stampsWord')}
                    </p>
                  </div>
                ) : null}

                {(() => {
                  const progressCurrent =
                    cfg.mode === 'points' ? selected.points_balance : selected.stamps_balance;
                  const progressMax = Math.max(1, activeLoyaltyProgram(cfg).threshold);
                  const progressPct = Math.min(
                    100,
                    Math.round((progressCurrent / progressMax) * 100)
                  );
                  return (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <span>{t('progressReward')}</span>
                        <span className="tabular-nums">
                          {progressCurrent} / {progressMax}
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2563eb] transition-[width] duration-300 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('visitNoteLabel')}
                  <input
                    type="text"
                    value={visitNote}
                    onChange={(e) => setVisitNote(e.target.value)}
                    maxLength={500}
                    placeholder={t('visitNotePh')}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('visitItemsLabel')}
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    inputMode="numeric"
                    value={visitItemsCount}
                    onChange={(e) => setVisitItemsCount(e.target.value)}
                    placeholder={t('visitItemsPh')}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm tabular-nums"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('ticketAmountLabel')}
                  {cfg.mode === 'points' && cfg.pointsPerEuro > 0 ? (
                    <span className="font-normal text-rose-600 dark:text-rose-400">
                      {t('ticketRequiredCredit')}
                    </span>
                  ) : null}
                  {cfg.mode === 'stamps' && cfg.stampsPerEuro > 0 ? (
                    <span className="font-normal text-rose-600 dark:text-rose-400">
                      {t('ticketRequiredCredit')}
                    </span>
                  ) : null}
                  {cfg.mode === 'points' && !(cfg.pointsPerEuro > 0) ? (
                    <span className="font-normal text-slate-400">{t('ticketOptionalPilotage')}</span>
                  ) : null}
                  {cfg.mode === 'stamps' && !(cfg.stampsPerEuro > 0) ? (
                    <span className="font-normal text-slate-400">{t('ticketOptionalPilotage')}</span>
                  ) : null}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={visitTicketEuros}
                    onChange={(e) => setVisitTicketEuros(e.target.value)}
                    placeholder={t('ticketPlaceholderEx')}
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm tabular-nums"
                  />
                  {cfg.mode === 'points' && cfg.pointsPerEuro > 0 ? (
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {(() => {
                        const totalPtsRate =
                          cfg.pointsPerEuro +
                          (bonusPerEuroLive ? Math.max(0, Number(cfg.bonus.pointsExtraPerEuro) || 0) : 0);
                        const bonusPart =
                          bonusPerEuroLive && cfg.bonus.pointsExtraPerEuro > 0
                            ? t('pointsBonusPart', {
                                base: cfg.pointsPerEuro,
                                extra: cfg.bonus.pointsExtraPerEuro,
                              })
                            : '';
                        const exampleGross = (50.01).toLocaleString(intlTag, INTL_EUR_CURRENCY_OPTS);
                        const examplePts = Math.ceil(50.01 * totalPtsRate);
                        return t('pointsRateFootnote', {
                          rate: totalPtsRate,
                          bonusPart,
                          exampleGross,
                          examplePts,
                        });
                      })()}
                    </span>
                  ) : null}
                  {cfg.mode === 'stamps' && cfg.stampsPerEuro > 0 ? (
                    <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {(() => {
                        const unitRate =
                          cfg.stampsPerEuro !== 1 ? t('stampUnitPlural') : t('stampUnitSingular');
                        const visitPart =
                          cfg.stampsPerVisit > 0
                            ? t('stampsVisitPartFmt', { n: cfg.stampsPerVisit })
                            : '';
                        const exampleStampsCount =
                          Math.ceil(
                            24.9 *
                              (cfg.stampsPerEuro +
                                (bonusPerEuroLive
                                  ? Math.max(0, Number(cfg.bonus.stampsExtraPerEuro) || 0)
                                  : 0))
                          ) + cfg.stampsPerVisit;
                        const unitEx =
                          exampleStampsCount !== 1 ? t('stampUnitPlural') : t('stampUnitSingular');
                        const bonusVisitPart =
                          bonusCreditLive &&
                          cfg.bonus.stampsExtraPerEuro <= 0 &&
                          cfg.bonus.stampsExtraPerVisit > 0
                            ? t('stampsBonusVisitPartFmt', {
                                n: cfg.bonus.stampsExtraPerVisit,
                              })
                            : '';
                        const exampleGrossStamps = (24.9).toLocaleString(intlTag, INTL_EUR_CURRENCY_OPTS);
                        return t('stampsRateFootnote', {
                          rate: cfg.stampsPerEuro,
                          unitRate,
                          visitPart,
                          exampleGross: exampleGrossStamps,
                          exampleStamps: exampleStampsCount,
                          unitEx,
                          bonusVisitPart,
                        });
                      })()}
                    </span>
                  ) : null}
                </label>

                <div className="flex flex-col gap-3 mt-auto">
                  {bonusPerEuroLive && cfg.mode === 'points' && cfg.bonus.pointsExtraPerEuro > 0 ? (
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/25 px-2.5 py-1.5">
                      {t('bonusActivePointsEuro', {
                        extra: cfg.bonus.pointsExtraPerEuro,
                        total: cfg.pointsPerEuro + cfg.bonus.pointsExtraPerEuro,
                      })}
                    </p>
                  ) : null}
                  {cfg.mode === 'points' &&
                  cfg.bonus.enabled &&
                  cfg.bonus.pointsExtraPerEuro > 0 &&
                  !bonusPerEuroLive ? (
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/50 px-2.5 py-1.5 leading-relaxed">
                      {t('bonusInactivePointsEuro', {
                        extra: cfg.bonus.pointsExtraPerEuro,
                        range:
                          cfg.bonus.startDate && cfg.bonus.endDate
                            ? t('bonusDateRangeParis', {
                                start: cfg.bonus.startDate.slice(0, 10),
                                end: cfg.bonus.endDate.slice(0, 10),
                              })
                            : '',
                      })}
                    </p>
                  ) : null}
                  {bonusCreditLive &&
                  cfg.mode === 'points' &&
                  cfg.bonus.pointsExtraPerEuro <= 0 &&
                  cfg.bonus.pointsExtraPerVisit > 0 ? (
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/25 px-2.5 py-1.5">
                      {t('bonusActivePointsVisit', { n: cfg.bonus.pointsExtraPerVisit })}
                    </p>
                  ) : null}
                  {bonusPerEuroLive && cfg.mode === 'stamps' && cfg.bonus.stampsExtraPerEuro > 0 ? (
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/25 px-2.5 py-1.5">
                      {t('bonusActiveStampsEuro', {
                        extra: cfg.bonus.stampsExtraPerEuro,
                        total: cfg.stampsPerEuro + cfg.bonus.stampsExtraPerEuro,
                      })}
                    </p>
                  ) : null}
                  {cfg.mode === 'stamps' &&
                  cfg.bonus.enabled &&
                  cfg.bonus.stampsExtraPerEuro > 0 &&
                  !bonusPerEuroLive ? (
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/50 px-2.5 py-1.5 leading-relaxed">
                      {t('bonusInactiveStampsEuro', {
                        rangeShort:
                          cfg.bonus.startDate && cfg.bonus.endDate
                            ? t('bonusDateRangeShort', {
                                start: cfg.bonus.startDate.slice(0, 10),
                                end: cfg.bonus.endDate.slice(0, 10),
                              })
                            : '',
                      })}
                    </p>
                  ) : null}
                  {bonusCreditLive &&
                  cfg.mode === 'stamps' &&
                  cfg.bonus.stampsExtraPerEuro <= 0 &&
                  cfg.bonus.stampsExtraPerVisit > 0 ? (
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/25 px-2.5 py-1.5">
                      {t('bonusActiveStampsVisit', { n: cfg.bonus.stampsExtraPerVisit })}
                    </p>
                  ) : null}
                  {cfg.mode === 'points' ? (
                    <>
                      <button
                        type="button"
                        disabled={transBusy || !pointsEarnVisitReady}
                        onClick={() => void transact('earn_visit')}
                        title={
                          !pointsEarnVisitReady ? t('titleEarnPoints') : undefined
                        }
                        className="w-full min-h-[52px] rounded-2xl bg-[#2563eb] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#1d4ed8] active:scale-[0.99] disabled:opacity-50 touch-manipulation"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        {t('purchasePointsBtn', { count: earnPointsTotalPreview })}
                      </button>
                      <div className="flex flex-col gap-2 w-full min-w-0">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 sr-only">
                          {t('partialDebitLabel')}
                        </label>
                        <input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          placeholder={t('redeemPartialPlaceholder')}
                          value={redeemPts}
                          onChange={(e) => setRedeemPts(e.target.value)}
                          className="w-full min-h-[52px] px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base touch-manipulation"
                        />
                        <button
                          type="button"
                          disabled={transBusy}
                          onClick={() => void transact('redeem_points')}
                          className="w-full min-h-[52px] px-4 rounded-2xl border-2 border-rose-500 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50 touch-manipulation active:scale-[0.99]"
                        >
                          {t('redeemPartialBtn')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={transBusy || !stampsEarnVisitReady}
                        title={
                          !stampsEarnVisitReady ? t('titleEarnStamps') : undefined
                        }
                        onClick={() => void transact('earn_visit')}
                        className="w-full min-h-[52px] rounded-2xl bg-[#2563eb] text-white font-semibold text-base flex items-center justify-center gap-2 hover:bg-[#1d4ed8] disabled:opacity-50 touch-manipulation active:scale-[0.99]"
                      >
                        <ShoppingBag className="w-5 h-5" />
                        {stampsEarnVisitReady
                          ? t('purchaseStampsBtn', { count: earnStampsTotalPreview })
                          : t('purchaseEnterAmount')}
                      </button>
                    </>
                  )}
                  {terminalVoucherEncaissementSection()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {editOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label={t('ariaClose')}
                onClick={() => {
                  if (!editBusy) setEditOpen(false);
                }}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="banano-terminal-edit-title"
                className="relative w-full sm:max-w-md max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col"
              >
                <div className="shrink-0 flex items-center justify-between gap-2 p-4 border-b border-slate-200 dark:border-zinc-800">
                  <h3
                    id="banano-terminal-edit-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-50"
                  >
                    {t('editClientTitle')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editBusy) setEditOpen(false);
                    }}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={t('ariaClose')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 text-sm">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelLastName')}
                    </span>
                    <input
                      value={editLast}
                      onChange={(e) => setEditLast(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                      autoCapitalize="characters"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelFirstName')}
                    </span>
                    <input
                      value={editFirst}
                      onChange={(e) => setEditFirst(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                      autoCapitalize="characters"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelPhone')}
                    </span>
                    <div className="mt-1">
                      <PhoneInput
                        id="banano-terminal-edit-phone"
                        value={editPhone}
                        onChange={(v) => setEditPhone(v ?? '')}
                        placeholder={t('placeholderPhoneLocal')}
                        containerClassName="w-full"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelBirthOptional')}
                    </span>
                    <input
                      type="date"
                      value={editBirth}
                      onChange={(e) => setEditBirth(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                    />
                  </label>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                    {t('addressOptionalHeading')}
                  </p>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelStreet')}
                    </span>
                    <input
                      value={editAddressLine}
                      onChange={(e) => setEditAddressLine(e.target.value)}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('placeholderCp')}
                      </span>
                      <input
                        value={editPostal}
                        onChange={(e) => setEditPostal(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('placeholderCity')}
                      </span>
                      <input
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {t('labelCountry')}
                    </span>
                    <input
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder={t('placeholderCountryEx')}
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                    />
                  </label>
                </div>
                <div className="shrink-0 flex gap-2 p-4 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={editBusy}
                    onClick={() => setEditOpen(false)}
                    className="flex-1 min-h-[48px] rounded-xl border border-slate-300 dark:border-zinc-600 font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={editBusy}
                    onClick={() => void saveMemberEditsTerminal()}
                    className="flex-1 min-h-[48px] rounded-xl bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('save')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {timelineDetail && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label={t('ariaClose')}
                onClick={() => setTimelineDetail(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="banano-timeline-detail-title"
                className="relative w-full sm:max-w-md max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col"
              >
                <div className="shrink-0 flex items-start justify-between gap-2 p-4 border-b border-slate-200 dark:border-zinc-800">
                  <h3
                    id="banano-timeline-detail-title"
                    className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-snug pr-2"
                  >
                    {timelineDetail.detail.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTimelineDetail(null)}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={t('ariaClose')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-3 sm:p-4 overflow-y-auto space-y-2 text-sm">
                  {timelineDetail.detail.rows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {row.label}
                      </p>
                      <p className="text-slate-800 dark:text-slate-100 mt-0.5 break-words text-sm font-medium">
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {voucherRedeemModal && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
                aria-label={t('ariaClose')}
                onClick={() => setVoucherRedeemModal(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="banano-voucher-redeem-title"
                className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-600 bg-white dark:bg-[#09090b] shadow-2xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3
                    id="banano-voucher-redeem-title"
                    className="text-base font-bold text-slate-900 dark:text-slate-50 pr-6"
                  >
                    {voucherRedeemModal.kind === 'staff_allowance'
                      ? t('modalStaffVoucher')
                      : t('modalLoyaltyVoucher')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setVoucherRedeemModal(null)}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500"
                    aria-label={t('ariaClose')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {selected ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selected.crm_role === 'staff' ? t('roleClientStaff') : t('roleClient')} :{' '}
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {selected.display_name}
                    </span>
                  </p>
                ) : null}
                <p className="font-mono text-sm font-bold text-[#2563eb] break-all">
                  {voucherRedeemModal.code}
                </p>
                {voucherRedeemModal.kind === 'staff_allowance' ? (
                  <div className="space-y-2">
                    <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      {t('staffVoucherIntro', {
                        balance: (voucherRedeemModal.remainingCents / 100).toLocaleString(intlTag, {
                          style: 'currency',
                          currency: 'EUR',
                          minimumFractionDigits: voucherRedeemModal.remainingCents % 100 === 0 ? 0 : 2,
                          maximumFractionDigits: 2,
                        }),
                      })}
                    </p>
                    <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {t('staffVoucherDebitField')}
                      <input
                        type="text"
                        inputMode="decimal"
                        value={staffVoucherDebitEuros}
                        onChange={(e) =>
                          setStaffVoucherDebitEuros(
                            e.target.value.replace(/[^\d.,]/g, '').slice(0, 14)
                          )
                        }
                        className="mt-1 w-full min-h-[48px] px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-base"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {t('loyaltyVoucherOneShot')}
                  </p>
                )}
                <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setVoucherRedeemModal(null)}
                    className="flex-1 min-h-[48px] rounded-xl border border-slate-200 dark:border-zinc-600 text-slate-800 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={voucherRedeemBusy}
                    onClick={() => void confirmVoucherRedeemFromModal()}
                    className="flex-1 min-h-[48px] rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-45"
                  >
                    {voucherRedeemBusy ? (
                      <span className="inline-flex items-center gap-2 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('validating')}
                      </span>
                    ) : (
                      t('confirmAtTill')
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

    </div>
  );
}
