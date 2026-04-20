'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  Briefcase,
  Cake,
  ChevronLeft,
  ChevronRight,
  Gift,
  Loader2,
  Users,
  TrendingUp,
  UserX,
  X,
  History,
  Pencil,
  Trash2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';
import { isBirthdayToday, type TimelineItem } from '@/lib/banano/loyalty-timeline-labels';
import { ManualWhatsAppComposerModal } from '@/components/banano/manual-whatsapp-composer-modal';
import { BananoCrmImportWizard } from '@/components/banano/banano-crm-import-wizard';
import { WhatsAppMark } from '@/components/banano/whatsapp-mark';
import { PhoneInput, isValidPhoneNumber } from '@/components/phone-input';
import { PREFERRED_LOCALE_LABEL } from '@/lib/banano/member-preferred-locale';
import {
  dispatchBananoStaffAllowanceSync,
  subscribeBananoStaffAllowanceSync,
} from '@/lib/banano/staff-allowance-client-sync';
import { VoucherMonthArchiveStrip } from '@/components/banano/voucher-month-archive-strip';
import { useDashboardDisplayTimeZone } from '@/components/dashboard/dashboard-timezone-provider';
import type { VoucherMonthArchiveListItem } from '@/lib/banano/voucher-month-archive-types';

type CrmFilter = 'all' | 'top_visits' | 'lost30';

type MemberRow = {
  id: string;
  phone_e164: string;
  preferred_locale?: string | null;
  display_name: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  address_line?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  points_balance: number;
  stamps_balance: number;
  last_visit_at: string | null;
  lifetime_visit_count?: number;
  created_at?: string | null;
  updated_at?: string;
  /** Mode points : bons disponibles non utilisés. */
  active_voucher_count?: number;
  crm_role?: string | null;
};

type DetailVoucherRow = {
  id: string;
  public_code: string;
  status: string;
  rewardLine: string;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  threshold_snapshot?: number;
  points_balance_after?: number;
};

type ArchiveVoucherRow = {
  id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  public_code: string;
  status: string;
  rewardLine: string;
  threshold_snapshot: number;
  points_balance_after: number;
  issuer_unit?: 'points' | 'stamps' | 'staff';
  voucher_class?: string;
  remaining_euro_cents?: number | null;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
};

type StaffAllowanceSettings = {
  enabled: boolean;
  monthlyEuroCents: number;
  validityDays: number | null;
};

type StaffDashActiveVoucher = {
  id: string;
  public_code: string;
  remaining_euro_cents: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  rewardLine: string;
};

type StaffDashEmployee = {
  id: string;
  display_name: string;
  phone_e164: string;
  crm_role: string | null;
  receives_staff_allowance: boolean;
  active_vouchers: StaffDashActiveVoucher[];
  total_remaining_euro_cents: number;
};

type StaffDashVoucher = {
  id: string;
  member_id: string;
  member_name: string;
  public_code: string;
  status: string;
  rewardLine: string;
  issued_euro_cents: number;
  remaining_euro_cents: number | null;
  points_balance_after: number;
  allowance_month_key: string | null;
  created_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
};

type StaffDashEvent = {
  id: string;
  member_id: string;
  member_name: string;
  event_type: string;
  note: string | null;
  amount_cents: number | null;
  created_at: string;
  staff_id: string | null;
  cashier_name?: string | null;
};

type StaffDashMeta = {
  generatedAt: string;
  voucherCount: number;
  eligibleCount: number;
  totalRemainingEuroCents: number;
  movementCount: number;
};

function formatFrEuroFromCents(cents: number): string {
  const n = Math.floor(cents);
  return (n / 100).toLocaleString(FR_LOCALE, {
    minimumFractionDigits: n % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}


function parseEuroInputToCents(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type InsightBadge = {
  key: string;
  label: string;
  variant: 'vip' | 'habitue' | 'danger' | 'nouveau';
};

type CrmInsights = {
  badge: InsightBadge;
  suggestion: string;
  sentiment: string | null;
  visit_percentile: number;
};

type MemberListCursor = { updated_at: string; id: string };

/** `wa.me` attend le numéro sans + (indicatif pays inclus). */
function whatsappDirectUrl(phoneE164: string | undefined): string | null {
  if (!phoneE164?.trim()) return null;
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

/** Affichage liste : jour et mois (année en fiche détail). */
function formatBirthdayCell(birthDate: string | null | undefined, emptyDash: string): string {
  if (!birthDate || typeof birthDate !== 'string') return emptyDash;
  const ymd = birthDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return emptyDash;
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return emptyDash;
  return d.toLocaleDateString(FR_LOCALE, FR_BDAY_CELL);
}

function badgeSurface(variant: InsightBadge['variant']) {
  switch (variant) {
    case 'vip':
      return 'border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/35 text-violet-900 dark:text-violet-100';
    case 'habitue':
      return 'border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/35 text-sky-900 dark:text-sky-100';
    case 'danger':
      return 'border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100';
    default:
      return 'border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/40 text-slate-800 dark:text-slate-100';
  }
}

/** Lignes par page (filtres « Tous » et « Perdus » — le Top 10 reste fixe). */
const PAGE_SIZE = 18;

const FR_LOCALE = 'fr-FR';
const FR_DATE_TIME: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
const FR_DATE: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};
const FR_DATE_LONG: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};
const FR_DATE_LONG_TIME: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
const FR_SNAPSHOT_TIME: DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};
const FR_BDAY_CELL: DateTimeFormatOptions = { day: 'numeric', month: 'short' };

type BaseClientsPageProps = {
  /** Intégré sous la page Banano : pas de conteneur pleine largeur dupliqué. */
  embedded?: boolean;
};

export function BaseClientsPage({ embedded = false }: BaseClientsPageProps) {
  const tc = useTranslations('common');
  const t = useTranslations('Dashboard.baseClients');
  const merchantDisplayTz = useDashboardDisplayTimeZone();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const memberParam = searchParams.get('member');
  const clientsViewRaw = searchParams.get('clientsView');
  const clientsView =
    clientsViewRaw === 'vouchers'
      ? 'vouchers'
      : clientsViewRaw === 'staff_vouchers'
        ? 'staff_vouchers'
        : 'list';

  const [filter, setFilter] = useState<CrmFilter>('all');
  const [loyaltyMode, setLoyaltyMode] = useState<'points' | 'stamps'>('points');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [totalHint, setTotalHint] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const memberAfterStackRef = useRef<(MemberListCursor | null | undefined)[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineDetail, setTimelineDetail] = useState<TimelineItem | null>(null);
  const [insights, setInsights] = useState<CrmInsights | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [manualWaMember, setManualWaMember] = useState<MemberRow | null>(null);
  const [detailVouchers, setDetailVouchers] = useState<DetailVoucherRow[]>([]);
  const [detailVouchersLoading, setDetailVouchersLoading] = useState(false);
  const [archiveRows, setArchiveRows] = useState<ArchiveVoucherRow[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'available' | 'expired' | 'redeemed'>('all');
  const [staffDashLoading, setStaffDashLoading] = useState(false);
  const [staffDashErr, setStaffDashErr] = useState<string | null>(null);
  const [staffDash, setStaffDash] = useState<{
    meta: StaffDashMeta;
    settings: StaffAllowanceSettings;
    employees: StaffDashEmployee[];
    vouchers: StaffDashVoucher[];
    events: StaffDashEvent[];
  } | null>(null);
  const [staffVoucherEditor, setStaffVoucherEditor] = useState<StaffDashVoucher | null>(null);
  const [staffVoucherEditRemainingEuros, setStaffVoucherEditRemainingEuros] = useState('');
  const [staffVoucherEditExpires, setStaffVoucherEditExpires] = useState('');
  const [staffVoucherEditStatus, setStaffVoucherEditStatus] = useState<'available' | 'expired' | 'redeemed'>(
    'available'
  );
  const [staffVoucherSaveBusy, setStaffVoucherSaveBusy] = useState(false);
  const [voucherMonthArchives, setVoucherMonthArchives] = useState<{
    loyalty: VoucherMonthArchiveListItem[];
    staff: VoucherMonthArchiveListItem[];
  }>({ loyalty: [], staff: [] });

  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editAddressLine, setEditAddressLine] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPostal, setEditPostal] = useState('');
  const [editCountry, setEditCountry] = useState('');
  /** Après mount : portails vers `document.body` et « anniversaire aujourd’hui » (fuseau local uniquement). */
  const [clientMounted, setClientMounted] = useState(false);

  const staffTimelineEventLabel = useCallback(
    (eventType: string) => {
      if (eventType === 'staff_allowance_issued') return t('staffEvent_allowanceIssued');
      if (eventType === 'staff_allowance_debit') return t('staffEvent_debit');
      if (eventType === 'staff_allowance_merchant_adjust') return t('staffEvent_merchantAdjust');
      return eventType;
    },
    [t]
  );

  const pushMemberQuery = useCallback(
    (id: string | null) => {
      const p = new URLSearchParams(searchParams.toString());
      if (id) {
        p.set('member', id);
        p.set('tab', 'clients');
      } else {
        p.delete('member');
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const setClientsViewParam = useCallback(
    (v: 'list' | 'vouchers' | 'staff_vouchers') => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', 'clients');
      if (v === 'vouchers') p.set('clientsView', 'vouchers');
      else if (v === 'staff_vouchers') p.set('clientsView', 'staff_vouchers');
      else p.delete('clientsView');
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const openMemberFromArchive = useCallback(
    (memberId: string) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', 'clients');
      p.delete('clientsView');
      p.set('member', memberId);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (filter === 'all') {
        const stack = memberAfterStackRef.current;
        let after: MemberListCursor | null = null;

        for (let p = 0; p <= pageIndex; p++) {
          if (p < pageIndex) {
            const cached = stack[p];
            if (cached === null) {
              setPageIndex(Math.max(0, p));
              setMembers([]);
              setTotalHint(0);
              return;
            }
            if (cached !== undefined) {
              after = cached;
              continue;
            }
          }

          const params = new URLSearchParams({
            filter: 'all',
            limit: String(PAGE_SIZE),
          });
          if (after) {
            params.set('afterUpdatedAt', after.updated_at);
            params.set('afterId', after.id);
          }
          const res = await fetch(`/api/banano/crm/members?${params}`);
          const data = (await res.json()) as {
            members?: MemberRow[];
            loyaltyMode?: string;
            totalHint?: number;
            nextCursor?: MemberListCursor | null;
            error?: string;
          };
          if (!res.ok) throw new Error(data.error ?? t('errLoad'));
          const nextC = data.nextCursor ?? null;
          stack[p] = nextC;
          if (p === pageIndex) {
            setMembers(data.members ?? []);
            setLoyaltyMode(data.loyaltyMode === 'stamps' ? 'stamps' : 'points');
            setTotalHint(data.totalHint ?? (data.members?.length ?? 0));
          }
          after = nextC;
          if (!after && p < pageIndex) {
            setPageIndex(Math.max(0, p));
            return;
          }
        }
      } else {
        const params = new URLSearchParams({ filter });
        if (filter === 'lost30') {
          params.set('limit', String(PAGE_SIZE));
          params.set('offset', String(pageIndex * PAGE_SIZE));
        }
        const res = await fetch(`/api/banano/crm/members?${params}`);
        const data = (await res.json()) as {
          members?: MemberRow[];
          loyaltyMode?: string;
          totalHint?: number;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? t('errLoad'));
        setMembers(data.members ?? []);
        setLoyaltyMode(data.loyaltyMode === 'stamps' ? 'stamps' : 'points');
        setTotalHint(data.totalHint ?? (data.members?.length ?? 0));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [filter, pageIndex, t]);

  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/banano/crm/vouchers-archive');
      const data = (await res.json()) as {
        vouchers?: ArchiveVoucherRow[];
        loyaltyMode?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errLoad'));
      setLoyaltyMode(data.loyaltyMode === 'stamps' ? 'stamps' : 'points');
      setArchiveRows(data.vouchers ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errGeneric'));
      setArchiveRows([]);
    } finally {
      setArchiveLoading(false);
    }
  }, [t]);

  const loadStaffDashboard = useCallback(async () => {
    setStaffDashLoading(true);
    setStaffDashErr(null);
    try {
      const res = await fetch('/api/banano/crm/staff-allowance-dashboard');
      const data = (await res.json()) as {
        meta?: StaffDashMeta;
        settings?: StaffAllowanceSettings;
        employees?: StaffDashEmployee[];
        vouchers?: StaffDashVoucher[];
        events?: StaffDashEvent[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errLoad'));
      const now = new Date().toISOString();
      const emps = data.employees ?? [];
      const vchs = data.vouchers ?? [];
      const evs = data.events ?? [];
      const totalRemFallback = emps.reduce((s, e) => s + (e.total_remaining_euro_cents ?? 0), 0);
      setStaffDash({
        meta: data.meta ?? {
          generatedAt: now,
          voucherCount: vchs.length,
          eligibleCount: emps.length,
          totalRemainingEuroCents: totalRemFallback,
          movementCount: evs.length,
        },
        settings: data.settings ?? { enabled: false, monthlyEuroCents: 0, validityDays: null },
        employees: data.employees ?? [],
        vouchers: data.vouchers ?? [],
        events: data.events ?? [],
      });
    } catch (e) {
      setStaffDashErr(e instanceof Error ? e.message : t('errGeneric'));
      setStaffDash(null);
    } finally {
      setStaffDashLoading(false);
    }
  }, [t]);

  const loadVoucherMonthArchives = useCallback(async () => {
    try {
      const res = await fetch('/api/banano/crm/voucher-month-archives/list');
      const data = (await res.json()) as {
        loyalty?: VoucherMonthArchiveListItem[];
        staff?: VoucherMonthArchiveListItem[];
        error?: string;
      };
      if (!res.ok) return;
      setVoucherMonthArchives({
        loyalty: data.loyalty ?? [],
        staff: data.staff ?? [],
      });
    } catch {
      /* ignore */
    }
  }, []);

  const openStaffVoucherEditor = useCallback((v: StaffDashVoucher) => {
    setStaffVoucherEditor(v);
    setStaffVoucherEditStatus(v.status === 'expired' || v.status === 'redeemed' ? v.status : 'available');
    const rem = Math.floor(Number(v.remaining_euro_cents ?? 0));
    setStaffVoucherEditRemainingEuros(
      (rem / 100).toLocaleString(FR_LOCALE, {
        minimumFractionDigits: rem % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })
    );
    setStaffVoucherEditExpires(toDatetimeLocalValue(v.expires_at));
  }, []);

  const saveStaffVoucherBoss = useCallback(async () => {
    if (!staffVoucherEditor) return;
    const cents = parseEuroInputToCents(staffVoucherEditRemainingEuros);
    if (cents === null) {
      toast.error(t('toastInvalidRemaining'));
      return;
    }
    const expTrim = staffVoucherEditExpires.trim();
    const expiresPayload = expTrim === '' ? null : new Date(expTrim).toISOString();

    setStaffVoucherSaveBusy(true);
    try {
      const res = await fetch(`/api/banano/crm/staff-vouchers/${staffVoucherEditor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remainingEuroCents: cents,
          expiresAt: expiresPayload,
          status: staffVoucherEditStatus,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(t('toastStaffVoucherUpdated'));
      setStaffVoucherEditor(null);
      void loadStaffDashboard();
      dispatchBananoStaffAllowanceSync({ source: 'merchant_voucher' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setStaffVoucherSaveBusy(false);
    }
  }, [
    staffVoucherEditor,
    staffVoucherEditRemainingEuros,
    staffVoucherEditExpires,
    staffVoucherEditStatus,
    loadStaffDashboard,
    t,
  ]);

  const deleteStaffVoucherBoss = useCallback(
    async (v: StaffDashVoucher) => {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm(t('confirmDeleteStaffVoucher', { code: v.public_code }));
      if (!ok) return;
      try {
        const res = await fetch(`/api/banano/crm/staff-vouchers/${v.id}`, { method: 'DELETE' });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
        toast.success(t('toastStaffVoucherDeleted'));
        setStaffVoucherEditor(null);
        void loadStaffDashboard();
        dispatchBananoStaffAllowanceSync({ source: 'merchant_voucher' });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('errGeneric'));
      }
    },
    [loadStaffDashboard, t]
  );

  useEffect(() => {
    setClientMounted(true);
  }, []);

  useEffect(() => {
    if (clientsView === 'vouchers') {
      void loadArchive();
      void loadVoucherMonthArchives();
      return;
    }
    if (clientsView === 'staff_vouchers') {
      void loadStaffDashboard();
      void loadVoucherMonthArchives();
      return;
    }
    void loadList();
  }, [clientsView, loadArchive, loadList, loadStaffDashboard, loadVoucherMonthArchives]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (clientsView === 'vouchers') {
        void loadArchive();
        void loadVoucherMonthArchives();
      } else if (clientsView === 'staff_vouchers') {
        void loadStaffDashboard();
        void loadVoucherMonthArchives();
      } else void loadList();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [clientsView, loadArchive, loadList, loadStaffDashboard, loadVoucherMonthArchives]);

  useEffect(() => {
    return subscribeBananoStaffAllowanceSync(() => {
      if (clientsView === 'staff_vouchers') void loadStaffDashboard();
      if (clientsView === 'vouchers') void loadArchive();
      if (clientsView === 'list') void loadList();
    });
  }, [clientsView, loadArchive, loadList, loadStaffDashboard]);

  useEffect(() => {
    setPageIndex(0);
    memberAfterStackRef.current = [];
  }, [filter]);

  useEffect(() => {
    if (!memberParam) {
      setDetailMember(null);
      setTimeline([]);
      setInsights(null);
      setDetailLoading(false);
      return;
    }

    setDetailMember(null);
    setTimeline([]);
    setInsights(null);
    setTimelineDetail(null);
    let cancelled = false;
    setDetailLoading(true);
    void fetch(`/api/banano/crm/members/${memberParam}/timeline`)
      .then((res) => res.json())
      .then(
        (data: {
          member?: MemberRow;
          items?: TimelineItem[];
          insights?: CrmInsights;
          error?: string;
        }) => {
          if (cancelled) return;
          if (data.error) {
            toast.error(data.error);
            pushMemberQuery(null);
            return;
          }
          if (data.member) {
            setDetailMember(data.member as MemberRow);
            setEditFirst((data.member.first_name ?? '').trim());
            setEditLast((data.member.last_name ?? '').trim());
            setEditPhone(data.member.phone_e164 ?? '');
            const bd = data.member.birth_date;
            setEditBirth(bd && typeof bd === 'string' ? bd.slice(0, 10) : '');
            const m = data.member as MemberRow;
            setEditAddressLine((m.address_line ?? '').trim());
            setEditCity((m.city ?? '').trim());
            setEditPostal((m.postal_code ?? '').trim());
            setEditCountry((m.country ?? '').trim());
          }
          setTimeline(data.items ?? []);
          setInsights(data.insights ?? null);
        }
      )
      .catch(() => {
        if (!cancelled) {
          toast.error(t('toastDetailLoadFailed'));
          pushMemberQuery(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memberParam, pushMemberQuery, t]);

  useEffect(() => {
    if (!memberParam || loyaltyMode !== 'points') {
      setDetailVouchers([]);
      return;
    }
    let cancelled = false;
    setDetailVouchersLoading(true);
    void fetch(`/api/banano/loyalty/members/${memberParam}/vouchers`)
      .then((r) => r.json())
      .then((data: { vouchers?: DetailVoucherRow[] }) => {
        if (cancelled) return;
        setDetailVouchers(data.vouchers ?? []);
      })
      .catch(() => {
        if (!cancelled) setDetailVouchers([]);
      })
      .finally(() => {
        if (!cancelled) setDetailVouchersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memberParam, loyaltyMode]);

  const closeDetail = useCallback(() => {
    setTimelineDetail(null);
    pushMemberQuery(null);
  }, [pushMemberQuery]);

  async function saveMemberEdits() {
    if (!memberParam) return;
    if (!isValidPhoneNumber(editPhone)) {
      toast.error(t('toastInvalidPhone'));
      return;
    }
    setSaveBusy(true);
    try {
      const res = await fetch(`/api/banano/loyalty/members/${memberParam}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editFirst,
          last_name: editLast,
          phone: editPhone,
          birth_date: editBirth.trim() || null,
          address_line: editAddressLine.trim() || null,
          city: editCity.trim() || null,
          postal_code: editPostal.trim() || null,
          country: editCountry.trim() || null,
        }),
      });
      const data = (await res.json()) as { member?: MemberRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      if (data.member) {
        setDetailMember(data.member as MemberRow);
        setEditFirst((data.member.first_name ?? '').trim());
        setEditLast((data.member.last_name ?? '').trim());
        setEditPhone(data.member.phone_e164 ?? '');
        const bd = data.member.birth_date;
        setEditBirth(bd && typeof bd === 'string' ? bd.slice(0, 10) : '');
      }
      toast.success(t('toastSheetSaved'));
      void loadList();
      if (clientsView === 'staff_vouchers') void loadStaffDashboard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSaveBusy(false);
    }
  }

  async function deleteMember() {
    if (!memberParam) return;
    const ok =
      typeof window !== 'undefined' && window.confirm(t('confirmDeleteMember'));
    if (!ok) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/banano/loyalty/members/${memberParam}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(t('toastClientDeleted'));
      pushMemberQuery(null);
      void loadList();
      if (clientsView === 'staff_vouchers') void loadStaffDashboard();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const filterButtons = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('filterAllClients'), icon: Users },
        { id: 'top_visits' as const, label: t('filterTop10'), icon: TrendingUp },
        { id: 'lost30' as const, label: t('filterLost30'), icon: UserX },
      ] as const,
    [t]
  );

  const archiveVoucherFilterOptions = useMemo(
    () =>
      [
        { id: 'all' as const, label: t('filterAll') },
        { id: 'available' as const, label: t('filterAvailable') },
        { id: 'expired' as const, label: t('filterExpired') },
        { id: 'redeemed' as const, label: t('filterRedeemed') },
      ] as const,
    [t]
  );

  const totalPages = Math.max(1, Math.ceil(totalHint / PAGE_SIZE));
  const currentPage = Math.min(totalPages, pageIndex + 1);
  const showPager =
    (filter === 'all' || filter === 'lost30') && totalHint > 0 && totalPages > 1;
  const showVoucherCol = true;
  const colCount = 6 + (filter === 'top_visits' ? 1 : 0) + (showVoucherCol ? 1 : 0);
  const detailOpen = Boolean(memberParam) && clientMounted;

  const filteredArchive = useMemo(() => {
    if (archiveFilter === 'all') return archiveRows;
    return archiveRows.filter((r) => r.status === archiveFilter);
  }, [archiveRows, archiveFilter]);

  const shellClass = embedded
    ? 'space-y-6 min-w-0 w-full overflow-x-hidden'
    : 'max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 min-w-0 w-full overflow-x-hidden';

  return (
    <div className={shellClass}>
      <header className="space-y-1">
        <h1 className={`font-display font-bold text-slate-900 dark:text-slate-50 ${embedded ? 'text-xl' : 'text-2xl'}`}>
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          <strong className="text-slate-700 dark:text-slate-300">{t('introDetailStrong')}</strong>{' '}
          {t('introDetailRest')}{' '}
          <code className="text-xs bg-slate-100 dark:bg-zinc-800 px-1 rounded break-all">
            {t('introUrlSnippet')}
          </code>
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          {t('introTop10')}{' '}
          <strong className="text-slate-600 dark:text-slate-300">{t('introSettingsStrong')}</strong>
          {t('introTop10End')}
        </p>
      </header>

      <div className="inline-flex flex-wrap rounded-xl border border-slate-200 dark:border-zinc-700 p-1 bg-slate-100/90 dark:bg-zinc-900/70 shadow-sm gap-1">
        <button
          type="button"
          onClick={() => setClientsViewParam('list')}
          className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            clientsView === 'list'
              ? 'bg-white dark:bg-zinc-800 text-[#2563eb] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          {t('tabList')}
        </button>
        <button
          type="button"
          onClick={() => setClientsViewParam('vouchers')}
          className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            clientsView === 'vouchers'
              ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Gift className="w-4 h-4 shrink-0" />
          {t('tabArchiveLoyalty')}
        </button>
        <button
          type="button"
          onClick={() => setClientsViewParam('staff_vouchers')}
          className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            clientsView === 'staff_vouchers'
              ? 'bg-white dark:bg-zinc-800 text-violet-700 dark:text-violet-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          {t('tabArchiveStaff')}
        </button>
      </div>

      {clientsView === 'vouchers' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {t('archiveIntro', {
              mode: loyaltyMode === 'stamps' ? t('modeStamps') : t('modePoints'),
            })}
          </p>
          <VoucherMonthArchiveStrip
            variant="emerald"
            downloadKind={'loyalty' as const}
            title={t('archiveCsvTitle')}
            items={voucherMonthArchives.loyalty}
            description={t('archiveCsvDesc')}
          />
          <div className="flex flex-wrap gap-2">
            {archiveVoucherFilterOptions.map(({ id: fid, label }) => (
              <button
                key={fid}
                type="button"
                onClick={() => setArchiveFilter(fid)}
                className={`min-h-[40px] px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  archiveFilter === fid
                    ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb] dark:text-blue-300'
                    : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadArchive()}
              className="min-h-[40px] px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900"
            >
              {t('refresh')}
            </button>
          </div>

          {err ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-200">
              {err}
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[1100px]">
                <thead className="bg-slate-50 dark:bg-zinc-900/80 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-3 font-semibold">{t('colClient')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colPhone')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colVoucherCode')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colReward')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colStatus')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colIssuedAt')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colValidUntil')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colUsedAt')}</th>
                    <th className="px-3 py-3 font-semibold tabular-nums">{t('colThresholdRemain')}</th>
                    <th className="px-3 py-3 font-semibold">{t('colSheet')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {archiveLoading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-60" />
                        {t('loadingArchive')}
                      </td>
                    </tr>
                  ) : filteredArchive.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                        {t('emptyArchiveFilter')}
                      </td>
                    </tr>
                  ) : (
                    filteredArchive.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/40">
                        <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100 max-w-[160px] truncate">
                          {r.member_name}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {r.member_phone}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-900 dark:text-slate-50">
                          {r.public_code}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700 dark:text-slate-300 max-w-[200px]">
                          {r.rewardLine}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                              r.status === 'available'
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : r.status === 'redeemed'
                                  ? 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-slate-200'
                                  : 'bg-amber-100 text-amber-950 dark:bg-amber-900/35 dark:text-amber-200'
                            }`}
                          >
                            {r.status === 'available'
                              ? t('statusAvailable')
                              : r.status === 'redeemed'
                                ? t('statusUsed')
                                : t('statusExpired')}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {r.expires_at
                            ? new Date(r.expires_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)
                            : t('emptyDash')}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {r.redeemed_at
                            ? new Date(r.redeemed_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)
                            : t('emptyDash')}
                        </td>
                        <td className="px-3 py-3 text-[11px] tabular-nums text-slate-600 dark:text-slate-400">
                          {r.threshold_snapshot}{' '}
                          {r.issuer_unit === 'stamps' ? t('thresholdStamps') : t('thresholdPts')} →{' '}
                          {t('thresholdRemainLabel')}{' '}
                          {r.points_balance_after}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => openMemberFromArchive(r.member_id)}
                            className="text-xs font-semibold text-[#2563eb] hover:underline"
                          >
                            {t('openSheet')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : clientsView === 'staff_vouchers' ? (
        <div className="space-y-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {t('staffIntro')}{' '}
            <strong className="text-slate-800 dark:text-slate-200">{t('staffIntroSettingsPath')}</strong>
            {'. '}
            {t('staffIntroRest')}
          </p>
          <VoucherMonthArchiveStrip
            variant="violet"
            downloadKind={'staff' as const}
            title={t('staffCsvTitle')}
            items={voucherMonthArchives.staff}
            description={t('staffCsvDesc')}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadStaffDashboard()}
              disabled={staffDashLoading}
              className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-900 disabled:opacity-50"
            >
              {staffDashLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {t('refresh')}
            </button>
            {staffDash ? (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {t('dataSnapshotLabel')}{' '}
                {new Date(staffDash.meta.generatedAt).toLocaleString(FR_LOCALE, FR_SNAPSHOT_TIME)}
              </span>
            ) : null}
          </div>
          {staffDashErr ? (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-200">
              {staffDashErr}
            </div>
          ) : null}
          {staffDashLoading ? (
            <div className="flex flex-col items-center gap-3 text-slate-500 py-16 justify-center">
              <Loader2 className="w-8 h-8 animate-spin opacity-60" />
              <p className="text-xs">{t('loadingStaffDash')}</p>
            </div>
          ) : staffDash ? (
            <div className="space-y-8">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-lg border border-violet-200/80 dark:border-violet-800/50 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:text-violet-100">
                  {t('eligibleBadge', { count: staffDash.meta.eligibleCount })}
                </span>
                <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t('voucherArchiveBadge', { count: staffDash.meta.voucherCount })}
                </span>
                <span className="inline-flex items-center rounded-lg border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/25 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-100 tabular-nums">
                  {t('usableBalanceTotal', {
                    amount: formatFrEuroFromCents(staffDash.meta.totalRemainingEuroCents),
                  })}
                </span>
                <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50/80 dark:bg-zinc-900/40 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('movementsBadge', { count: staffDash.meta.movementCount })}
                </span>
              </div>
              <div className="rounded-xl border border-violet-200/80 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 p-4 text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-violet-950 dark:text-violet-100 mb-2">{t('activeSettingsTitle')}</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>
                    {t('autoGenLabel')}{' '}
                    <strong>{staffDash.settings.enabled ? t('autoGenOn') : t('autoGenOff')}</strong>
                  </li>
                  <li>
                    {t('monthlyPerPerson')}{' '}
                    <strong>
                      {staffDash.settings.monthlyEuroCents > 0
                        ? `${formatFrEuroFromCents(staffDash.settings.monthlyEuroCents)} €`
                        : t('emptyDash')}
                    </strong>
                  </li>
                  <li>
                    {t('validityAfterIssue')}{' '}
                    <strong>
                      {staffDash.settings.validityDays != null
                        ? t('validityDays', { days: staffDash.settings.validityDays })
                        : t('validityUnlimited')}
                    </strong>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide mb-3">
                  {t('employeesSectionTitle')}
                </h2>
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[720px]">
                      <thead className="bg-slate-50 dark:bg-zinc-900/80 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3 font-semibold">{t('colCollaborator')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colPhone')}</th>
                          <th className="px-3 py-3 font-semibold tabular-nums">{t('colTotalRemaining')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colActiveVouchers')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colSheet')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {staffDash.employees.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">
                              {t('emptyStaffEmployees')}
                            </td>
                          </tr>
                        ) : (
                          staffDash.employees.map((em) => (
                            <tr key={em.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/40">
                              <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                                {em.display_name}
                              </td>
                              <td className="px-3 py-3 font-mono text-xs text-slate-600">{em.phone_e164}</td>
                              <td className="px-3 py-3 tabular-nums font-semibold text-violet-700 dark:text-violet-300">
                                {formatFrEuroFromCents(em.total_remaining_euro_cents)} €
                              </td>
                              <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
                                {em.active_vouchers.length === 0 ? (
                                  <span className="text-slate-400">{t('noUsableVoucher')}</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {em.active_vouchers.map((v) => (
                                      <li key={v.id}>
                                        <span className="font-mono font-semibold">{v.public_code}</span> ·{' '}
                                        {t('voucherRemain')}{' '}
                                        {formatFrEuroFromCents(v.remaining_euro_cents)} €
                                        {v.expires_at ? (
                                          <span className="text-slate-400">
                                            {' '}
                                            · {t('voucherExpireShort')}{' '}
                                            {new Date(v.expires_at).toLocaleDateString(FR_LOCALE, FR_BDAY_CELL)}
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => openMemberFromArchive(em.id)}
                                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                                >
                                  {t('openSheet')}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide mb-3">
                  {t('movementsSectionTitle')}
                </h2>
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm text-left min-w-[640px]">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-900/95 text-xs uppercase text-slate-500 z-10">
                        <tr>
                          <th className="px-3 py-3 font-semibold">{t('colDate')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colType')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colCollaborator')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colCashier')}</th>
                          <th className="px-3 py-3 font-semibold tabular-nums">{t('colAmount')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colDetail')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {staffDash.events.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                              {t('emptyMovements')}
                            </td>
                          </tr>
                        ) : (
                          staffDash.events.map((ev) => (
                            <tr key={ev.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/40">
                              <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                {new Date(ev.created_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)}
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-violet-800 dark:text-violet-200">
                                {staffTimelineEventLabel(ev.event_type)}
                              </td>
                              <td className="px-3 py-2 text-xs">{ev.member_name}</td>
                              <td className="px-3 py-2 text-xs text-slate-600">
                                {ev.cashier_name ?? (ev.staff_id ? t('cashierEquipier') : t('emptyDash'))}
                              </td>
                              <td className="px-3 py-2 text-xs tabular-nums">
                                {ev.amount_cents != null && ev.amount_cents > 0
                                  ? `−${formatFrEuroFromCents(ev.amount_cents)} €`
                                  : t('emptyDash')}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 max-w-[320px]">
                                {ev.note ?? t('emptyDash')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide mb-3">
                  {t('staffArchiveTitle')}
                </h2>
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm text-left min-w-[900px]">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-900/95 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3 font-semibold">{t('colCollaborator')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colCode')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colMonth')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colStatus')}</th>
                          <th className="px-3 py-3 font-semibold tabular-nums">{t('colIssuedEuro')}</th>
                          <th className="px-3 py-3 font-semibold tabular-nums">{t('colRemainEuro')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colIssuedAt')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colExpire')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colSheet')}</th>
                          <th className="px-3 py-3 font-semibold">{t('colManager')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {staffDash.vouchers.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-slate-500 text-sm">
                              {t('emptyStaffVouchers')}
                            </td>
                          </tr>
                        ) : (
                          staffDash.vouchers.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/40">
                              <td className="px-3 py-2 text-xs font-medium max-w-[140px] truncate">
                                {v.member_name}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs font-semibold">{v.public_code}</td>
                              <td className="px-3 py-2 text-xs text-slate-600">
                                {v.allowance_month_key ?? t('emptyDash')}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                                    v.status === 'available'
                                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                                      : v.status === 'redeemed'
                                        ? 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-slate-200'
                                        : 'bg-amber-100 text-amber-950 dark:bg-amber-900/35 dark:text-amber-200'
                                  }`}
                                >
                                  {v.status === 'available'
                                    ? t('statusAvailable')
                                    : v.status === 'redeemed'
                                      ? t('statusRedeemedFull')
                                      : t('statusExpired')}
                                </span>
                              </td>
                              <td className="px-3 py-2 tabular-nums text-xs">
                                {formatFrEuroFromCents(v.issued_euro_cents)} €
                              </td>
                              <td className="px-3 py-2 tabular-nums text-xs font-semibold text-violet-700 dark:text-violet-300">
                                {v.remaining_euro_cents != null
                                  ? `${formatFrEuroFromCents(v.remaining_euro_cents)} €`
                                  : t('emptyDash')}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                {new Date(v.created_at).toLocaleString(FR_LOCALE, FR_DATE)}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                {v.expires_at
                                  ? new Date(v.expires_at).toLocaleDateString(FR_LOCALE, FR_DATE)
                                  : t('emptyDash')}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => openMemberFromArchive(v.member_id)}
                                  className="text-xs font-semibold text-[#2563eb] hover:underline"
                                >
                                  {t('openSheet')}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openStaffVoucherEditor(v)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:underline"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    {t('edit')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteStaffVoucherBoss(v)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {t('delete')}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('staffDataUnavailable')}</p>
          )}
        </div>
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold transition-colors ${
                filter === id
                  ? 'bg-[#2563eb] text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <BananoCrmImportWizard
          loyaltyMode={loyaltyMode}
          onImported={() => {
            void loadList();
            void loadArchive();
            void loadStaffDashboard();
          }}
        />
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-800 dark:text-red-200">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[820px]">
            <thead className="bg-slate-50 dark:bg-zinc-900/80 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">{t('colFirstName')}</th>
                <th className="px-4 py-3 font-semibold">{t('colLastName')}</th>
                <th className="px-4 py-3 font-semibold">
                  {t('colPhoneAction')}{' '}
                  <span className="font-normal normal-case text-slate-400">{t('phoneActionHint')}</span>
                </th>
                <th className="px-4 py-3 font-semibold">{t('colBirthday')}</th>
                <th className="px-4 py-3 font-semibold">{t('colLastVisit')}</th>
                <th className="px-4 py-3 font-semibold">
                  {loyaltyMode === 'stamps' ? t('colLoyaltyBalanceStamps') : t('colLoyaltyBalancePoints')}
                </th>
                {showVoucherCol ? (
                  <th className="px-4 py-3 font-semibold tabular-nums text-center">{t('colActiveVouchersShort')}</th>
                ) : null}
                {filter === 'top_visits' ? (
                  <th className="px-4 py-3 font-semibold tabular-nums">{t('colVisits')}</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-16 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 opacity-60" />
                    {t('loadingList')}
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-12 text-center text-slate-500">
                    {t('emptyListFilter')}
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const fn = (m.first_name ?? '').trim() || t('emptyDash');
                  const ln = (m.last_name ?? '').trim() || t('emptyDash');
                  const bal = loyaltyMode === 'stamps' ? m.stamps_balance : m.points_balance;
                  const visits = m.lifetime_visit_count ?? 0;
                  const rowSelected = memberParam === m.id;
                  const birthdayToday = clientMounted && isBirthdayToday(m.birth_date, merchantDisplayTz);
                  const waUrl = whatsappDirectUrl(m.phone_e164);
                  return (
                    <tr
                      key={m.id}
                      className={`cursor-pointer transition-colors ${
                        birthdayToday
                          ? 'bg-gradient-to-r from-amber-50 via-rose-50/90 to-amber-50 dark:from-amber-950/45 dark:via-rose-950/35 dark:to-amber-950/40 ring-2 ring-inset ring-amber-400/70 dark:ring-amber-500/50 shadow-[inset_3px_0_0_0] shadow-amber-500 dark:shadow-amber-400'
                          : rowSelected
                            ? 'bg-[#2563eb]/10 dark:bg-[#2563eb]/15'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50'
                      }`}
                      onClick={() => pushMemberQuery(m.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          pushMemberQuery(m.id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={
                        birthdayToday ? t('ariaBirthdayRow', { name: fn }) : undefined
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <span className="inline-flex items-center gap-2">
                          {birthdayToday ? (
                            <Cake
                              className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400"
                              aria-hidden
                            />
                          ) : null}
                          {fn}
                          {m.crm_role === 'staff' ? (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-800 dark:bg-violet-500/30 dark:text-violet-200 border border-violet-400/40 dark:border-violet-500/35">
                              {t('badgeEmployee')}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{ln}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs tabular-nums">{m.phone_e164}</span>
                          {waUrl ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManualWaMember(m);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#25D366] hover:bg-[#25D366]/15 dark:hover:bg-[#25D366]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 shrink-0 transition-colors"
                              title={t('waTooltip')}
                              aria-label={t('waAriaWrite', { name: fn })}
                            >
                              <WhatsAppMark className="w-5 h-5" />
                            </button>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {formatBirthdayCell(m.birth_date, t('emptyDash'))}
                          {birthdayToday ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200 bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-md">
                              {t('birthdayToday')}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {m.last_visit_at
                          ? new Date(m.last_visit_at).toLocaleDateString(FR_LOCALE, FR_DATE)
                          : t('emptyDash')}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-[#2563eb]">{bal}</td>
                      {showVoucherCol ? (
                        <td className="px-4 py-3 tabular-nums text-center font-medium text-emerald-700 dark:text-emerald-400">
                          {m.active_voucher_count ?? 0}
                        </td>
                      ) : null}
                      {filter === 'top_visits' ? (
                        <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">
                          {visits}
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {showPager ? (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
              <span className="tabular-nums">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {totalHint === 0
                    ? t('emptyDash')
                    : t('paginationRangeLabel', {
                        from: pageIndex * PAGE_SIZE + 1,
                        to: Math.min(pageIndex * PAGE_SIZE + members.length, totalHint),
                      })}
                </span>{' '}
                {t('paginationOf')}{' '}
                {t('paginationClients', { total: totalHint })}
              </span>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  {t('pageLabel')} {currentPage} {t('pageOf')} {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('btnPrev')}
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages || loading}
                    onClick={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {t('btnNext')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {totalPages <= 12 ? (
              <nav className="flex flex-wrap gap-1.5 justify-center sm:justify-start" aria-label={t('paginationNavAria')}>
                {Array.from({ length: totalPages }, (_, i) => {
                  const p = i + 1;
                  const active = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      disabled={loading}
                      onClick={() => setPageIndex(i)}
                      className={`min-h-[36px] min-w-[36px] px-2 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                        active
                          ? 'bg-[#2563eb] text-white shadow-sm'
                          : 'border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      } disabled:opacity-40`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  );
                })}
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>
        </>
      )}

      {detailOpen && memberParam
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex justify-end">
              <button
                type="button"
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                aria-label={tc('close')}
                onClick={closeDetail}
              />
              <aside className="relative w-full max-w-lg h-full bg-white dark:bg-[#09090b] border-l border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
                <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-zinc-800">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#2563eb] flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      {t('detailKicker')}
                    </p>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                      {detailLoading && !detailMember
                        ? t('loadingShort')
                        : detailMember?.display_name ||
                          `${detailMember?.first_name ?? ''} ${detailMember?.last_name ?? ''}`.trim() ||
                          t('fallbackClientName')}
                    </h2>
                    {detailMember && !detailLoading ? (
                      <>
                        <p className="text-sm font-mono text-slate-600 dark:text-slate-300 mt-1 break-all">
                          {detailMember.phone_e164}
                        </p>
                        {detailMember.preferred_locale ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {t('preferredLocaleHint')}{' '}
                            <span className="font-semibold text-slate-600 dark:text-slate-300">
                              {PREFERRED_LOCALE_LABEL[detailMember.preferred_locale] ??
                                detailMember.preferred_locale.toUpperCase()}
                            </span>
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5 break-all">
                      {t('idLabel')} {memberParam}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={tc('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                  {detailLoading && !detailMember ? (
                    <div className="flex flex-col items-center py-12 text-slate-500 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      {t('loadingDetailSheet')}
                    </div>
                  ) : !detailMember ? (
                    <p className="text-sm text-slate-500 text-center py-8">{t('sheetNotFound')}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {loyaltyMode === 'points' ? (
                        <div className="rounded-xl border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-center col-span-2 sm:col-span-2">
                          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                            {detailMember.points_balance}
                          </p>
                          <p className="text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-200">
                            {t('labelPoints')}
                          </p>
                        </div>
                        ) : (
                        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-center col-span-2 sm:col-span-2">
                          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                            {detailMember.stamps_balance}
                          </p>
                          <p className="text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-200">
                            {t('labelStamps')}
                          </p>
                        </div>
                        )}
                        <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/40 p-3 text-center col-span-2 sm:col-span-1">
                          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                            {detailMember.lifetime_visit_count ?? 0}
                          </p>
                          <p className="text-[10px] font-semibold uppercase text-slate-500">{t('labelVisitsRegister')}</p>
                        </div>
                      </div>

                      {insights ? (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {t('insightsSectionTitle')}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold ${badgeSurface(
                              insights.badge.variant
                            )}`}
                          >
                            {insights.badge.label}
                          </span>
                          {insights.suggestion ? (
                            <div className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-950/25 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" />
                                {t('suggestionAiTitle')}
                              </p>
                              <p className="text-sm text-slate-800 dark:text-slate-100 mt-1.5 leading-snug">
                                {insights.suggestion}
                              </p>
                            </div>
                          ) : null}
                          {insights.sentiment ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                              {insights.sentiment}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">{t('noGoogleReviews')}</p>
                          )}
                        </div>
                      ) : null}

                      <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                          <dt className="text-slate-500">{t('dtLastVisit')}</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
                            {detailMember.last_visit_at
                              ? new Date(detailMember.last_visit_at).toLocaleString(FR_LOCALE, FR_DATE_LONG_TIME)
                              : t('emptyDash')}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
                          <dt className="text-slate-500">{t('dtCreated')}</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-100 text-right">
                            {detailMember.created_at
                              ? new Date(detailMember.created_at).toLocaleDateString(FR_LOCALE, FR_DATE_LONG)
                              : t('emptyDash')}
                          </dd>
                        </div>
                      </dl>

                      {loyaltyMode === 'points' ? (
                        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            {t('sectionLoyaltyVouchers')}
                          </h3>
                          {detailVouchersLoading ? (
                            <p className="text-sm text-slate-500 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('loadingInline')}
                            </p>
                          ) : detailVouchers.length === 0 ? (
                            <p className="text-xs text-slate-500">{t('noVouchersForClient')}</p>
                          ) : (
                            <ul className="space-y-2 max-h-56 overflow-y-auto text-sm">
                              {detailVouchers.map((v) => (
                                <li
                                  key={v.id}
                                  className="rounded-lg border border-slate-200/90 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/50 p-2.5"
                                >
                                  <div className="flex justify-between gap-2 flex-wrap">
                                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-50">
                                      {v.public_code}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                        v.status === 'available'
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                          : v.status === 'redeemed'
                                            ? 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-slate-200'
                                            : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                                      }`}
                                    >
                                      {v.status === 'available'
                                        ? t('statusAvailable')
                                        : v.status === 'redeemed'
                                          ? t('statusUsed')
                                          : t('statusExpired')}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{v.rewardLine}</p>
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {t('issuedOn')}{' '}
                                    {new Date(v.created_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)}
                                    {v.redeemed_at
                                      ? ` · ${t('usedOn')} ${new Date(v.redeemed_at).toLocaleString(FR_LOCALE, FR_DATE_TIME)}`
                                      : ''}
                                    {v.expires_at && v.status === 'available'
                                      ? ` · ${t('expiresShort')} ${new Date(v.expires_at).toLocaleDateString(FR_LOCALE, FR_DATE)}`
                                      : ''}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <Pencil className="w-4 h-4 text-[#2563eb]" />
                          {t('editSheetTitle')}
                        </h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block text-xs font-medium text-slate-500">
                            {t('labelFirstName')}
                            <input
                              value={editFirst}
                              onChange={(e) => setEditFirst(e.target.value)}
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-500">
                            {t('labelLastName')}
                            <input
                              value={editLast}
                              onChange={(e) => setEditLast(e.target.value)}
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                            />
                          </label>
                        </div>
                        <div className="block text-xs font-medium text-slate-500">
                          {t('labelPhone')}
                          <div className="mt-1">
                            <PhoneInput
                              id="base-clients-edit-phone"
                              value={editPhone}
                              onChange={(v) => setEditPhone(v ?? '')}
                              placeholder={t('phonePlaceholder')}
                              containerClassName="w-full"
                            />
                          </div>
                        </div>
                        <label className="block text-xs font-medium text-slate-500">
                          {t('labelBirthday')}
                          <input
                            type="date"
                            value={editBirth}
                            onChange={(e) => setEditBirth(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                          />
                        </label>
                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-1">
                          {t('addressSectionTitle')}
                        </p>
                        <label className="block text-xs font-medium text-slate-500">
                          {t('labelStreet')}
                          <input
                            value={editAddressLine}
                            onChange={(e) => setEditAddressLine(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                            autoComplete="off"
                          />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="block text-xs font-medium text-slate-500">
                            {t('labelPostal')}
                            <input
                              value={editPostal}
                              onChange={(e) => setEditPostal(e.target.value)}
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                              autoComplete="off"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-500">
                            {t('labelCity')}
                            <input
                              value={editCity}
                              onChange={(e) => setEditCity(e.target.value)}
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                              autoComplete="off"
                            />
                          </label>
                        </div>
                        <label className="block text-xs font-medium text-slate-500">
                          {t('labelCountry')}
                          <input
                            value={editCountry}
                            onChange={(e) => setEditCountry(e.target.value)}
                            placeholder={t('countryPlaceholder')}
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                            autoComplete="off"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={saveBusy}
                            onClick={() => void saveMemberEdits()}
                            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50"
                          >
                            {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            disabled={deleteBusy}
                            onClick={() => void deleteMember()}
                            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border-2 border-red-500 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                          >
                            {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {t('deleteSheet')}
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 opacity-60" />
                          {t('historyFullTitle')}
                        </h3>
                        {timeline.length === 0 ? (
                          <p className="text-sm text-slate-500 py-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-zinc-700">
                            {t('historyEmpty')}
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {timeline.map((it) => (
                              <li key={it.id}>
                                <button
                                  type="button"
                                  onClick={() => setTimelineDetail(it)}
                                  className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm leading-snug transition-colors cursor-pointer hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 ${
                                    it.kind === 'review'
                                      ? 'border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20'
                                      : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40'
                                  }`}
                                >
                                  {it.label}
                                  <span className="block text-[10px] text-slate-400 mt-1">
                                    {t('clickForDetail')}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </aside>
            </div>,
            document.body
          )
        : null}

      {timelineDetail && clientMounted
        ? createPortal(
            <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
                aria-label={t('closeDetailAria')}
                onClick={() => setTimelineDetail(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="timeline-detail-title"
                className="relative w-full sm:max-w-md max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col"
              >
                <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-zinc-800">
                  <h3
                    id="timeline-detail-title"
                    className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-snug pr-2"
                  >
                    {timelineDetail.detail.title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTimelineDetail(null)}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={tc('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 text-sm">
                  {timelineDetail.detail.rows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {row.label}
                      </p>
                      <p className="text-slate-800 dark:text-slate-100 mt-0.5 break-words font-medium">
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

      <ManualWhatsAppComposerModal
        member={manualWaMember}
        onClose={() => setManualWaMember(null)}
        onSent={() => void loadList()}
      />

      {staffVoucherEditor && clientMounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <button
                type="button"
                aria-label={tc('close')}
                className="absolute inset-0 bg-slate-950/50 dark:bg-black/55 backdrop-blur-sm"
                onClick={() => !staffVoucherSaveBusy && setStaffVoucherEditor(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="staff-voucher-edit-title"
                className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 id="staff-voucher-edit-title" className="text-base font-bold text-slate-900 dark:text-slate-50">
                    {t('staffVoucherModalTitle')}
                  </h2>
                  <button
                    type="button"
                    disabled={staffVoucherSaveBusy}
                    onClick={() => setStaffVoucherEditor(null)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={tc('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-mono">{staffVoucherEditor.public_code}</p>
                <p className="text-[11px] text-slate-500">
                  {t('staffVoucherIssuedHint', {
                    issued: formatFrEuroFromCents(staffVoucherEditor.issued_euro_cents),
                  })}
                </p>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('labelRemainingEuro')}
                  <input
                    value={staffVoucherEditRemainingEuros}
                    onChange={(e) => setStaffVoucherEditRemainingEuros(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('labelExpiration')}
                  <input
                    type="datetime-local"
                    value={staffVoucherEditExpires}
                    onChange={(e) => setStaffVoucherEditExpires(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t('labelStatus')}
                  <select
                    value={staffVoucherEditStatus}
                    onChange={(e) =>
                      setStaffVoucherEditStatus(e.target.value as 'available' | 'expired' | 'redeemed')
                    }
                    className="mt-1 w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  >
                    <option value="available">{t('statusAvailable')}</option>
                    <option value="expired">{t('statusExpired')}</option>
                    <option value="redeemed">{t('statusRedeemedFull')}</option>
                  </select>
                </label>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                  <button
                    type="button"
                    disabled={staffVoucherSaveBusy}
                    onClick={() => setStaffVoucherEditor(null)}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-zinc-600 text-sm font-semibold"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={staffVoucherSaveBusy}
                    onClick={() => void saveStaffVoucherBoss()}
                    className="min-h-[44px] px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {staffVoucherSaveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t('save')}
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
