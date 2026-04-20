'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
  type ReactNode,
} from 'react';
import {
  Archive,
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { type PilotageDashboardPayload } from '@/lib/banano/pilotage/types';
import { groupPilotageActivityFeed, type PilotageActivityFeedItem } from '@/lib/banano/group-pilotage-activity-feed';
import type {
  PilotageAutomationStatusSnapshot,
  PilotageCalendarMonthBundle,
  PilotageCashDeskMetrics,
} from '@/lib/banano/pilotage/operational-types';
import { PilotageCommercialHero } from '@/components/banano/pilotage-commercial-hero';
import { PilotageCashVsLoyaltyChart } from '@/components/banano/pilotage-cash-vs-loyalty-chart';
import {
  PilotageEliteCommandDeck,
  PilotageEliteCommandSkeleton,
} from '@/components/banano/pilotage-elite-command-deck';
import { PilotageOperationalDeck } from '@/components/banano/pilotage-operational-deck';
import { PilotageDailyCashExplorer } from '@/components/banano/pilotage-daily-cash-explorer';
import type { VoucherMonthArchiveListItem } from '@/lib/banano/voucher-month-archive-types';
import { ArchivesDrawer } from '@/components/banano/archives-drawer';

function formatPilotageEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

type ActivityCursor = { created_at: string; id: string };

type StaffStatApiRow = {
  id: string;
  display_name: string;
  is_active: boolean;
  clientsCreated: number;
  revenueCents: number;
  googlePositiveReviews: number;
  ticketsEncaisse: number;
  transformPercent: number;
  avgBasketCents: number;
};

const ACTIVITY_PAGE = 15;
const STAFF_TABLE_PAGE = 6;
const CAISSE_TABLE_PAGE = 7;
const CASH_TERMINAL_PAGE = 8;
const CASH_STAFF_PAGE = 8;

const INTL_MONTH_LONG_OPTS = { month: 'long' as const };

const PILOTAGE_SESSION_CACHE_PREFIX = 'banano-pilotage:v1:';
const MERCHANT_TIMEZONE_FALLBACK = 'Europe/Paris';

function pilotageSessionCacheKey(locale: string, y: number, m: number): string {
  return `${PILOTAGE_SESSION_CACHE_PREFIX}${locale}:${y}:${m}`;
}

function buildPilotageStateFromJson(
  json: PilotageDashboardPayload,
  calNav: { y: number; m: number },
  forecastUnavailable: string
): PilotageDashboardPayload {
  const emptyLoyalty = {
    day: { pointsDistributed: 0, stampsEarned: 0, vouchersGenerated: 0 },
    week: { pointsDistributed: 0, stampsEarned: 0, vouchersGenerated: 0 },
    month: { pointsDistributed: 0, stampsEarned: 0, vouchersGenerated: 0 },
  };
  const emptyCash: PilotageCashDeskMetrics = {
    fromIso: '',
    toExclusiveIso: '',
    walletRevenueCents: 0,
    loyalWalletRevenueCents: 0,
    casualWalletRevenueCents: 0,
    walletVisitCount: 0,
    visitsWithAmountCount: 0,
    visitsWithStaffCount: 0,
    avgBasketWalletCents: null,
    avgBasketLoyalMemberCents: null,
    avgBasketCasualMemberCents: null,
    loyalVisitEventCount: 0,
    casualVisitEventCount: 0,
    uniqueWalletMembersWithVisit: 0,
  };
  const emptyCal: PilotageCalendarMonthBundle = {
    year: calNav.y,
    month: calNav.m,
    monthLabel: '',
    cells: [],
  };
  const emptyAuto: PilotageAutomationStatusSnapshot = {
    birthdayMessagesSentToday: 0,
    pushAttributedRevenueMonthCents: 0,
    pushSendsCountMonth: 0,
    automationStatsMonthStart: '',
    relanceRulesEnabled: {
      lost_client: false,
      birthday: false,
      vip_of_month: false,
      new_client_welcome: false,
    },
    relanceSendsMonth: { lost_client: 0, birthday: 0, vip_of_month: 0, new_client_welcome: 0 },
  };
  return {
    ...json,
    retentionFunnel: json.retentionFunnel ?? {
      newClientsThisMonth: 0,
      returnedAtLeastTwiceThisMonth: 0,
      vipProfilesCount: 0,
    },
    retentionFunnelDetail: json.retentionFunnelDetail ?? {
      newMembers: [],
      returnedTwice: [],
      vipProfiles: [],
    },
    weekdayHeat: Array.isArray(json.weekdayHeat) ? json.weekdayHeat : [],
    loyaltyProgramKpis: json.loyaltyProgramKpis ?? emptyLoyalty,
    monthlyFinancial: json.monthlyFinancial
      ? {
          ...json.monthlyFinancial,
          forecastLine: json.monthlyFinancial.forecastLine ?? forecastUnavailable,
        }
      : null,
    loyaltyProfitabilityMonth:
      json.loyaltyProfitabilityMonth != null ? json.loyaltyProfitabilityMonth : null,
    merchantTimeZone: json.merchantTimeZone ?? MERCHANT_TIMEZONE_FALLBACK,
    cashDeskMetrics: json.cashDeskMetrics ?? emptyCash,
    calendarMonth: json.calendarMonth ?? emptyCal,
    automationStatus: (() => {
      const a = json.automationStatus ?? {};
      return {
        ...emptyAuto,
        ...a,
        relanceRulesEnabled: {
          ...emptyAuto.relanceRulesEnabled,
          ...(a.relanceRulesEnabled ?? {}),
        },
        relanceSendsMonth: {
          ...emptyAuto.relanceSendsMonth,
          ...(a.relanceSendsMonth ?? {}),
        },
      };
    })(),
    feedWall: Array.isArray(json.feedWall) ? json.feedWall : [],
    atRiskMembers: Array.isArray(json.atRiskMembers) ? json.atRiskMembers : [],
    merchantEstablishmentName:
      typeof json.merchantEstablishmentName === 'string' ? json.merchantEstablishmentName : '',
    viewerUserId: typeof json.viewerUserId === 'string' ? json.viewerUserId : '',
    total_cash_ingested_month:
      typeof json.total_cash_ingested_month === 'number' && Number.isFinite(json.total_cash_ingested_month)
        ? Math.max(0, Math.floor(json.total_cash_ingested_month))
        : 0,
    cash_terminal_month: Array.isArray(json.cash_terminal_month) ? json.cash_terminal_month : [],
    cash_staff_month: Array.isArray(json.cash_staff_month) ? json.cash_staff_month : [],
  };
}

function PilotageSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} className="space-y-4 scroll-mt-6" aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[11px] font-bold uppercase tracking-wide text-zinc-300"
      >
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function BananoOmnipresentDashboard() {
  const locale = useLocale();
  const t = useTranslations('Dashboard.bananoOmnipresent');
  const [data, setData] = useState<PilotageDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [relaunchBusy, setRelaunchBusy] = useState(false);
  const [staffRows, setStaffRows] = useState<StaffStatApiRow[]>([]);
  const [staffStatsDisclaimer, setStaffStatsDisclaimer] = useState<string | null>(null);
  const [staffStatsLoading, setStaffStatsLoading] = useState(true);
  const [staffPageIdx, setStaffPageIdx] = useState(0);
  const [staffStatsYear, setStaffStatsYear] = useState(() => String(new Date().getFullYear()));
  const [staffStatsMonth, setStaffStatsMonth] = useState(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [staffPeriodLabel, setStaffPeriodLabel] = useState<string | null>(null);
  const [activityLines, setActivityLines] = useState<PilotageActivityFeedItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityTotal, setActivityTotal] = useState(0);
  /** `afterStack[p]` = curseur API après la page p (ligne la plus ancienne du lot). */
  const activityAfterStackRef = useRef<(ActivityCursor | null)[]>([]);
  const [activityPageIdx, setActivityPageIdx] = useState(0);
  const [activityHasOlder, setActivityHasOlder] = useState(false);
  const [archiveExportYear, setArchiveExportYear] = useState(() =>
    String(new Date().getFullYear())
  );
  const [archiveExportMonth, setArchiveExportMonth] = useState(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [cashExplorerOpen, setCashExplorerOpen] = useState(false);
  const [caissePageIdx, setCaissePageIdx] = useState(0);
  const [cashTermPageIdx, setCashTermPageIdx] = useState(0);
  const [cashStaffSyncPageIdx, setCashStaffSyncPageIdx] = useState(0);
  const [voucherMonthArchives, setVoucherMonthArchives] = useState<{
    loyalty: VoucherMonthArchiveListItem[];
    staff: VoucherMonthArchiveListItem[];
  }>({ loyalty: [], staff: [] });
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [activityDetailKey, setActivityDetailKey] = useState<string | null>(null);
  const [calNav, setCalNav] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });

  const onPilotageCalendarChange = useCallback((y: number, m: number) => {
    setCalNav({ y, m });
    setCashTermPageIdx(0);
    setCashStaffSyncPageIdx(0);
  }, []);

  const dataRef = useRef(data);
  dataRef.current = data;
  const pilotageSuccessKeyRef = useRef<string | null>(null);

  const loadPilotage = useCallback(async () => {
    const requestKey = `${locale}:${calNav.y}:${calNav.m}`;
    const samePeriodAsLastOk =
      pilotageSuccessKeyRef.current === requestKey && dataRef.current != null;
    if (!samePeriodAsLastOk) {
      setLoading(true);
    }
    setErr(null);
    try {
      const r = await fetch(
        `/api/banano/pilotage?locale=${encodeURIComponent(locale)}&calendarYear=${calNav.y}&calendarMonth=${calNav.m}`
      );
      const json = (await r.json().catch(() => null)) as
        | (PilotageDashboardPayload & { error?: string })
        | null;
      if (!r.ok || !json) {
        pilotageSuccessKeyRef.current = null;
        startTransition(() => {
          setData(null);
          setErr(
            typeof json?.error === 'string' && json.error.trim()
              ? json.error
              : t('errLoadPilotage')
          );
        });
        return;
      }
      if (json.error) {
        pilotageSuccessKeyRef.current = null;
        startTransition(() => {
          setData(null);
          setErr(typeof json.error === 'string' ? json.error : t('errLoadPilotage'));
        });
        return;
      }
      if (!json.temporal || !json.smartCards || !Array.isArray(json.reports)) {
        pilotageSuccessKeyRef.current = null;
        startTransition(() => {
          setErr(t('errInvalidResponse'));
          setData(null);
        });
        return;
      }
      const built = buildPilotageStateFromJson(json, calNav, t('forecastUnavailable'));
      pilotageSuccessKeyRef.current = requestKey;
      try {
        sessionStorage.setItem(
          pilotageSessionCacheKey(locale, calNav.y, calNav.m),
          JSON.stringify(json)
        );
      } catch {
        /* quota / private mode */
      }
      startTransition(() => {
        setData(built);
      });
    } catch {
      pilotageSuccessKeyRef.current = null;
      startTransition(() => {
        setErr(t('errLoadPilotage'));
        setData(null);
      });
    } finally {
      setLoading(false);
    }
  }, [locale, t, calNav.y, calNav.m]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(pilotageSessionCacheKey(locale, calNav.y, calNav.m));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PilotageDashboardPayload & { error?: string };
      if (parsed.error || !parsed.temporal || !parsed.smartCards || !Array.isArray(parsed.reports)) {
        return;
      }
      const built = buildPilotageStateFromJson(parsed, calNav, t('forecastUnavailable'));
      let didHydrate = false;
      setData((prev) => {
        if (prev) return prev;
        didHydrate = true;
        return built;
      });
      if (didHydrate) {
        pilotageSuccessKeyRef.current = `${locale}:${calNav.y}:${calNav.m}`;
        setLoading(false);
      }
    } catch {
      /* ignore */
    }
  }, [locale, calNav.y, calNav.m, t]);

  const refreshPilotage = useCallback(() => {
    void loadPilotage();
  }, [loadPilotage]);

  const loadVoucherMonthArchives = useCallback(async () => {
    try {
      const r = await fetch('/api/banano/crm/voucher-month-archives/list');
      const j = (await r.json()) as {
        loyalty?: VoucherMonthArchiveListItem[];
        staff?: VoucherMonthArchiveListItem[];
        error?: string;
      };
      if (!r.ok) return;
      setVoucherMonthArchives({
        loyalty: j.loyalty ?? [],
        staff: j.staff ?? [],
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadPilotage();
  }, [loadPilotage]);

  useEffect(() => {
    void loadVoucherMonthArchives();
  }, [loadVoucherMonthArchives]);

  useEffect(() => {
    if (archivesOpen) void loadVoucherMonthArchives();
  }, [archivesOpen, loadVoucherMonthArchives]);

  useEffect(() => {
    setCaissePageIdx(0);
  }, [data]);

  const loadStaffStats = useCallback(async () => {
    setStaffStatsLoading(true);
    try {
      const qs = new URLSearchParams({
        year: staffStatsYear.trim(),
        month: String(parseInt(staffStatsMonth, 10)),
      });
      const qsLocale = new URLSearchParams(qs);
      qsLocale.set('locale', locale);
      const sRes = await fetch(`/api/banano/staff/stats?${qsLocale.toString()}`);
      const sJson = (await sRes.json()) as {
        rows?: StaffStatApiRow[];
        disclaimer?: string;
        periodLabel?: string;
        periodLabelFr?: string;
        error?: string;
      };
      if (sRes.ok && sJson.rows) {
        setStaffRows(sJson.rows);
        setStaffStatsDisclaimer(sJson.rows.length > 0 ? t('staffGoogleDisclaimer') : null);
        const pl = sJson.periodLabel ?? sJson.periodLabelFr;
        setStaffPeriodLabel(typeof pl === 'string' ? pl : null);
      } else {
        setStaffRows([]);
        setStaffStatsDisclaimer(null);
        setStaffPeriodLabel(null);
      }
    } catch {
      setStaffRows([]);
      setStaffStatsDisclaimer(null);
      setStaffPeriodLabel(null);
    } finally {
      setStaffStatsLoading(false);
    }
  }, [staffStatsYear, staffStatsMonth, locale, t]);

  const loadActivityFeed = useCallback(async () => {
    setActivityLoading(true);
    try {
      const stack = activityAfterStackRef.current;
      let after: ActivityCursor | null = null;

      for (let p = 0; p <= activityPageIdx; p++) {
        if (p < activityPageIdx) {
          const cached = stack[p];
          if (cached === null) {
            setActivityPageIdx(Math.max(0, p));
            setActivityLines([]);
            setActivityTotal(0);
            setActivityHasOlder(false);
            return;
          }
          if (cached !== undefined) {
            after = cached;
            continue;
          }
        }

        const params = new URLSearchParams({ limit: String(ACTIVITY_PAGE) });
        params.set('uiLocale', locale);
        if (after) {
          params.set('afterCreatedAt', after.created_at);
          params.set('afterId', after.id);
        }
        const aRes = await fetch(`/api/banano/activity-feed?${params.toString()}`);
        const aJson = (await aRes.json()) as {
          items?: Partial<PilotageActivityFeedItem>[];
          total?: number;
          nextCursor?: ActivityCursor | null;
          error?: string;
        };
        if (!aRes.ok || !aJson.items) {
          setActivityLines([]);
          setActivityTotal(0);
          setActivityHasOlder(false);
          return;
        }
        const normalized: PilotageActivityFeedItem[] = aJson.items.map((raw, idx) => {
          const at = typeof raw.at === 'string' ? raw.at : '';
          const id = typeof raw.id === 'string' ? raw.id : `${at || 'row'}-${idx}`;
          return {
            id,
            at,
            line: typeof raw.line === 'string' ? raw.line : '',
            member_id: typeof raw.member_id === 'string' ? raw.member_id : '',
            event_type: typeof raw.event_type === 'string' ? raw.event_type : '',
            client_name: typeof raw.client_name === 'string' ? raw.client_name : '',
            staff_name: raw.staff_name ?? null,
          };
        });
        stack[p] = aJson.nextCursor ?? null;
        if (p === activityPageIdx) {
          setActivityLines(normalized);
          setActivityTotal(typeof aJson.total === 'number' ? aJson.total : aJson.items.length);
          setActivityHasOlder(Boolean(aJson.nextCursor));
        }
        after = stack[p];
        if (!after && p < activityPageIdx) {
          setActivityPageIdx(Math.max(0, p));
          setActivityHasOlder(false);
          return;
        }
      }
    } catch {
      setActivityLines([]);
      setActivityTotal(0);
      setActivityHasOlder(false);
    } finally {
      setActivityLoading(false);
    }
  }, [activityPageIdx, locale]);

  useEffect(() => {
    void loadStaffStats();
  }, [loadStaffStats]);

  useEffect(() => {
    void loadActivityFeed();
  }, [loadActivityFeed]);

  useEffect(() => {
    setActivityDetailKey(null);
  }, [activityPageIdx]);

  useEffect(() => {
    const last = Math.max(0, Math.ceil(staffRows.length / STAFF_TABLE_PAGE) - 1);
    setStaffPageIdx((idx) => (idx > last ? last : idx));
  }, [staffRows.length]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = undefined;
        void Promise.all([loadPilotage(), loadStaffStats(), loadActivityFeed()]);
      }, 400);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loadPilotage, loadStaffStats, loadActivityFeed]);

  async function sendRiskWhatsAppRelaunch() {
    setRelaunchBusy(true);
    try {
      const res = await fetch('/api/banano/pilotage/relaunch-whatsapp', { method: 'POST' });
      const json = (await res.json()) as {
        ok?: boolean;
        sent?: number;
        failed?: number;
        skippedCooldown?: number;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? t('errSendImpossible'));
      }
      const sent = json.sent ?? 0;
      const failed = json.failed ?? 0;
      const skipped = json.skippedCooldown ?? 0;

      if (sent > 0) {
        toast.success(t('toastWaSent', { count: sent }), {
          description: skipped > 0 ? t('toastWaSkippedDesc', { skipped }) : undefined,
        });
      } else if (skipped > 0 && failed === 0) {
        toast.message(t('toastWaAllSkipped'));
      } else if (failed > 0) {
        toast.error(json.errors?.[0] ?? t('toastWaFailed'));
      } else {
        toast.message(t('toastWaNoTargets'));
      }

      await loadPilotage();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setRelaunchBusy(false);
    }
  }

  const traceabilityMonthLinks = useMemo(() => {
    const out: { ym: string; label: string }[] = [];
    const d = new Date();
    for (let i = 1; i <= 6; i++) {
      const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({
        ym: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
        label: monthDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
      });
    }
    return out;
  }, [locale]);

  const staffSliceStart = staffPageIdx * STAFF_TABLE_PAGE;
  const staffPageRows = useMemo(
    () => staffRows.slice(staffSliceStart, staffSliceStart + STAFF_TABLE_PAGE),
    [staffRows, staffSliceStart]
  );
  const staffPageCount = Math.max(1, Math.ceil(staffRows.length / STAFF_TABLE_PAGE) || 1);

  const activityPageCount = Math.max(1, Math.ceil(activityTotal / ACTIVITY_PAGE) || 1);
  const currentActivityPage = activityPageIdx + 1;

  const formatActivityGroupLine = useCallback(
    (args: {
      count: number;
      clientName: string;
      eventTypes: string[];
      staffName: string | null;
      at: string;
    }) => {
      const uniq = [...new Set(args.eventTypes)];
      const staffPart = args.staffName
        ? t('activityFeedGroupStaffSuffix', { staff: args.staffName })
        : '';
      if (uniq.length === 1 && uniq[0] === 'voucher_redeemed' && args.staffName) {
        return t('activityFeedGroupVouchersStaff', { count: args.count, staff: args.staffName });
      }
      if (uniq.length === 1 && uniq[0] === 'voucher_redeemed') {
        return t('activityFeedGroupVouchersClient', { count: args.count, client: args.clientName });
      }
      return t('activityFeedGroupMixed', {
        count: args.count,
        client: args.clientName,
        staffPart,
      });
    },
    [t]
  );

  const groupedActivityLines = useMemo(
    () => groupPilotageActivityFeed(activityLines, formatActivityGroupLine),
    [activityLines, formatActivityGroupLine]
  );

  const updatedLabel = useMemo(() => {
    if (!data?.generatedAt) return null;
    return new Date(data.generatedAt).toLocaleString(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, [data?.generatedAt, locale]);

  const cashTerminalRows = data?.cash_terminal_month ?? [];
  const cashStaffSyncRows = data?.cash_staff_month ?? [];
  const cashTermSliceStart = cashTermPageIdx * CASH_TERMINAL_PAGE;
  const cashStaffSyncSliceStart = cashStaffSyncPageIdx * CASH_STAFF_PAGE;
  const cashTermPageRows = useMemo(
    () => cashTerminalRows.slice(cashTermSliceStart, cashTermSliceStart + CASH_TERMINAL_PAGE),
    [cashTerminalRows, cashTermSliceStart]
  );
  const cashStaffSyncPageRows = useMemo(
    () => cashStaffSyncRows.slice(cashStaffSyncSliceStart, cashStaffSyncSliceStart + CASH_STAFF_PAGE),
    [cashStaffSyncRows, cashStaffSyncSliceStart]
  );
  const cashTermPageCount = Math.max(1, Math.ceil(cashTerminalRows.length / CASH_TERMINAL_PAGE) || 1);
  const cashStaffSyncPageCount = Math.max(1, Math.ceil(cashStaffSyncRows.length / CASH_STAFF_PAGE) || 1);

  useEffect(() => {
    setCashTermPageIdx((idx) => Math.min(idx, Math.max(0, cashTermPageCount - 1)));
  }, [cashTermPageCount, cashTerminalRows.length]);

  useEffect(() => {
    setCashStaffSyncPageIdx((idx) => Math.min(idx, Math.max(0, cashStaffSyncPageCount - 1)));
  }, [cashStaffSyncPageCount, cashStaffSyncRows.length]);

  return (
    <div className="max-w-full overflow-x-clip text-zinc-100 rounded-[20px] border border-zinc-800/70 bg-zinc-950/80 shadow-xl shadow-black/20">
      <header className="sticky top-0 z-50 flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-700/35 bg-zinc-950/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-zinc-950/55 rounded-t-[20px] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.45)]">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 text-amber-400">
            <BarChart3 className="w-5 h-5 shrink-0" />
            <h2 className="text-xl font-display font-bold text-zinc-50">{t('title')}</h2>
          </div>
          {updatedLabel ? (
            <p className="text-xs text-zinc-400">{t('lastUpdated', { date: updatedLabel })}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setArchivesOpen(true)}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-[14px] border border-zinc-600/70 bg-zinc-800/90 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/90 hover:border-zinc-500 shadow-sm shadow-black/20"
        >
          <Archive className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
          {t('archivesDrawerTrigger')}
        </button>
      </header>

      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-4 sm:pt-5 space-y-8 sm:space-y-10">
      {loading && !err && !data ? (
        <div
          key="pilotage-elite-zone"
          className="rounded-[14px] border border-zinc-700/80 bg-zinc-900/60 p-4 sm:p-5 transition-[min-height] duration-300 ease-in-out shadow-lg shadow-black/25"
        >
          <PilotageEliteCommandSkeleton />
        </div>
      ) : null}
      {!loading && !err && data ? (
        <div
          key="pilotage-command-unified"
          className="rounded-[14px] border border-amber-500/25 bg-zinc-950 shadow-[0_20px_50px_-20px_rgba(251,191,36,0.22),0_0_0_1px_rgba(255,255,255,0.04)_inset] transition-[min-height] duration-300 ease-in-out overflow-hidden"
        >
          <div className="p-4 sm:p-5">
            <PilotageEliteCommandDeck
              establishmentName={data.merchantEstablishmentName}
              periodLabel={data.calendarMonth?.monthLabel ?? ''}
              cashDeskMetrics={data.cashDeskMetrics}
              temporal={data.temporal}
              atRiskMembers={data.atRiskMembers}
              feedWall={data.feedWall}
              viewerUserId={data.viewerUserId}
              merchantTimeZone={data.merchantTimeZone ?? MERCHANT_TIMEZONE_FALLBACK}
              onRefreshPilotage={refreshPilotage}
            />
          </div>
          {data.temporal ? (
            <div className="border-t border-amber-500/20 bg-gradient-to-b from-zinc-900/90 to-zinc-950 px-4 sm:px-5 py-4 sm:py-5">
              <section
                id="pilotage-overview"
                className="rounded-[14px] border border-zinc-600/50 bg-zinc-900/85 px-3 py-3 sm:px-4 sm:py-4 space-y-3 scroll-mt-6 shadow-md shadow-black/20 ring-1 ring-white/5"
                aria-labelledby="pilotage-overview-heading"
              >
                <h3
                  id="pilotage-overview-heading"
                  className="text-[11px] font-bold uppercase tracking-wide text-zinc-300"
                >
                  {t('pilotageSectionOverviewTitle')}
                </h3>
                <PilotageCommercialHero
                  smartCards={data.smartCards}
                  onRelaunchWhatsApp={() => void sendRiskWhatsAppRelaunch()}
                  relaunchBusy={relaunchBusy}
                  monthlyFinancial={data.monthlyFinancial}
                  loyaltyProfitabilityMonth={data.loyaltyProfitabilityMonth}
                  loyaltyProgramKpis={data.loyaltyProgramKpis}
                  hasTicketAmounts={data.hasTicketAmounts}
                  dailyActivity={data.dailyActivity}
                  compact
                />
                <PilotageCashVsLoyaltyChart
                  cashCents={data.total_cash_ingested_month ?? 0}
                  loyaltyCents={data.loyaltyProfitabilityMonth?.revenueGrossCents ?? 0}
                  locale={locale}
                />
              </section>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !err && data ? (
        <PilotageSection id="pilotage-operations" title={t('pilotageSectionOpsTitle')}>
          <PilotageOperationalDeck
            cashDeskMetrics={data.cashDeskMetrics}
            calendarMonth={data.calendarMonth}
            automationStatus={data.automationStatus}
            hasTicketAmounts={data.hasTicketAmounts}
            calendarYear={calNav.y}
            calendarMonthNum={calNav.m}
            onCalendarChange={onPilotageCalendarChange}
          />
        </PilotageSection>
      ) : null}

      {!loading && !err && data ? (
        <PilotageSection id="pilotage-cash-terminals" title={t('pilotageSectionCashSyncTitle')}>
          <p className="text-xs text-zinc-400 -mt-2 mb-1">{t('pilotageSectionCashSyncDesc')}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <section
              className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/25 ring-1 ring-white/5"
              aria-label={t('ariaCashTerminalTable')}
            >
              <div className="flex items-center gap-2 text-zinc-200">
                <Store className="w-5 h-5 shrink-0 text-amber-400/90" aria-hidden />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  {t('cashTerminalTableTitle')}
                </h3>
              </div>
              {cashTerminalRows.length === 0 ? (
                <p className="text-sm text-zinc-400">{t('cashTerminalTableEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-[14px] border border-zinc-600/50 bg-zinc-800/40">
                    <table className="w-full text-sm min-w-[280px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-300 border-b border-zinc-600/60 bg-zinc-800/80">
                          <th className="px-3 py-2.5 font-semibold">{t('cashTerminalColId')}</th>
                          <th className="px-3 py-2.5 font-semibold tabular-nums">{t('cashTerminalColTickets')}</th>
                          <th className="px-3 py-2.5 font-semibold tabular-nums">{t('cashTerminalColRevenue')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashTermPageRows.map((row) => (
                          <tr
                            key={row.terminalId}
                            className="border-b border-zinc-700/50 text-zinc-100"
                          >
                            <td className="px-3 py-2.5 font-medium truncate max-w-[12rem]">{row.terminalId}</td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-200">{row.ticketCount}</td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-200">
                              {formatPilotageEur(row.revenueCents, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {cashTerminalRows.length > CASH_TERMINAL_PAGE ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <button
                        type="button"
                        disabled={cashTermPageIdx <= 0}
                        onClick={() => setCashTermPageIdx((i) => Math.max(0, i - 1))}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('pagePrev')}
                      </button>
                      <span className="tabular-nums">
                        {t('cashSyncPageInfo', {
                          current: cashTermPageIdx + 1,
                          total: cashTermPageCount,
                          n: cashTerminalRows.length,
                        })}
                      </span>
                      <button
                        type="button"
                        disabled={cashTermPageIdx >= cashTermPageCount - 1}
                        onClick={() => setCashTermPageIdx((i) => Math.min(cashTermPageCount - 1, i + 1))}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        {t('pageNext')}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
            <section
              className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/25 ring-1 ring-white/5"
              aria-label={t('ariaCashStaffTable')}
            >
              <div className="flex items-center gap-2 text-zinc-200">
                <Users className="w-5 h-5 shrink-0 text-amber-400/90" aria-hidden />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                  {t('cashStaffPerformanceTitle')}
                </h3>
              </div>
              {cashStaffSyncRows.length === 0 ? (
                <p className="text-sm text-zinc-400">{t('cashStaffPerformanceEmpty')}</p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-[14px] border border-zinc-600/50 bg-zinc-800/40">
                    <table className="w-full text-sm min-w-[320px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-300 border-b border-zinc-600/60 bg-zinc-800/80">
                          <th className="px-3 py-2.5 font-semibold">{t('cashStaffColName')}</th>
                          <th className="px-3 py-2.5 font-semibold tabular-nums">{t('cashStaffColTickets')}</th>
                          <th className="px-3 py-2.5 font-semibold tabular-nums">{t('cashStaffColRevenue')}</th>
                          <th className="px-3 py-2.5 font-semibold tabular-nums">{t('cashStaffColCapture')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashStaffSyncPageRows.map((row) => (
                          <tr
                            key={row.staffName}
                            className="border-b border-zinc-700/50 text-zinc-100"
                          >
                            <td className="px-3 py-2.5 font-medium truncate max-w-[10rem]">{row.staffName}</td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-200">{row.ticketCount}</td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-200">
                              {formatPilotageEur(row.revenueCents, locale)}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-zinc-200">
                              {row.capturePercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {cashStaffSyncRows.length > CASH_STAFF_PAGE ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                      <button
                        type="button"
                        disabled={cashStaffSyncPageIdx <= 0}
                        onClick={() => setCashStaffSyncPageIdx((i) => Math.max(0, i - 1))}
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        {t('pagePrev')}
                      </button>
                      <span className="tabular-nums">
                        {t('cashStaffPageInfo', {
                          current: cashStaffSyncPageIdx + 1,
                          total: cashStaffSyncPageCount,
                          n: cashStaffSyncRows.length,
                        })}
                      </span>
                      <button
                        type="button"
                        disabled={cashStaffSyncPageIdx >= cashStaffSyncPageCount - 1}
                        onClick={() =>
                          setCashStaffSyncPageIdx((i) => Math.min(cashStaffSyncPageCount - 1, i + 1))
                        }
                        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                      >
                        {t('pageNext')}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </PilotageSection>
      ) : null}

      <PilotageSection id="pilotage-team" title={t('pilotageSectionTeamTitle')}>
      <section
        className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-4 shadow-lg shadow-black/25 ring-1 ring-white/5"
        aria-label={t('ariaStaffPerformance')}
      >
        <div className="flex items-center gap-2 text-zinc-200">
          <Users className="w-5 h-5 shrink-0 text-amber-400/90" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0 flex-1">
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide shrink-0">
              {t('staffTitle')}
            </h3>
            <div className="flex flex-wrap items-end gap-2 text-xs">
              <label className="text-zinc-300 font-medium">
                {t('monthLabel')}
                <select
                  value={staffStatsMonth}
                  onChange={(e) => setStaffStatsMonth(e.target.value)}
                  className="mt-1 ml-1 min-h-[36px] px-2 rounded-[10px] border border-zinc-600 bg-zinc-800 text-zinc-100 tabular-nums"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return (
                      <option key={m} value={m}>
                        {new Date(2000, i, 1).toLocaleDateString(locale, INTL_MONTH_LONG_OPTS)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="text-zinc-300 font-medium">
                {t('yearLabel')}
                <input
                  type="number"
                  min={2018}
                  max={new Date().getFullYear()}
                  value={staffStatsYear}
                  onChange={(e) => setStaffStatsYear(e.target.value)}
                  className="mt-1 ml-1 w-[5.5rem] min-h-[36px] px-2 rounded-[10px] border border-zinc-600 bg-zinc-800 text-zinc-100 tabular-nums"
                />
              </label>
            </div>
          </div>
        </div>
        {staffPeriodLabel ? (
          <p className="text-xs font-semibold text-zinc-400 capitalize">
            {t('periodPrefix', { label: staffPeriodLabel })}
          </p>
        ) : null}
        {staffStatsLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('loadingStaffStats')}
          </div>
        ) : staffRows.length === 0 ? (
          <p className="text-sm text-zinc-400">{t('staffEmpty')}</p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-[14px] border border-zinc-600/50 bg-zinc-800/40">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-300 border-b border-zinc-600/60 bg-zinc-800/80">
                    <th className="px-3 py-2.5 font-semibold">{t('staffColName')}</th>
                    <th className="px-3 py-2.5 font-semibold tabular-nums">{t('thTickets')}</th>
                    <th className="px-3 py-2.5 font-semibold">{t('thStaffTransform')}</th>
                    <th className="px-3 py-2.5 font-semibold w-[1%] whitespace-nowrap">{t('staffColDetails')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staffPageRows.map((r) => (
                    <Fragment key={r.id}>
                    <tr
                      className="border-b border-zinc-700/50 text-zinc-100"
                    >
                      <td className="px-3 py-2.5 font-semibold">
                        <span className="truncate max-w-[14rem] inline-block align-bottom">
                          {r.display_name}
                          {!r.is_active ? (
                            <span className="ml-1.5 text-[10px] font-normal text-amber-500/90">
                              {t('inactive')}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-200">{r.ticketsEncaisse}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="shrink-0 w-12 sm:w-14 h-1.5 rounded-full bg-zinc-700 overflow-hidden"
                            title={t('titleBarPct', {
                              pct: r.transformPercent.toLocaleString(locale, { maximumFractionDigits: 1 }),
                            })}
                          >
                            <div
                              className="h-full rounded-full bg-amber-400"
                              style={{ width: `${Math.min(100, r.transformPercent)}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-zinc-200">
                            {r.transformPercent.toLocaleString(locale, { maximumFractionDigits: 1 })}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedStaffId((id) => (id === r.id ? null : r.id))}
                          className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 hover:underline"
                        >
                          {t('staffDetailsToggle')}
                        </button>
                      </td>
                    </tr>
                    {expandedStaffId === r.id ? (
                      <tr className="bg-zinc-800/40 border-b border-zinc-700/50">
                        <td colSpan={4} className="px-3 py-3 text-xs text-zinc-300">
                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex justify-between gap-2 border-b border-zinc-800/80 pb-1 sm:border-0 sm:pb-0">
                              <dt>{t('thFiches')}</dt>
                              <dd className="tabular-nums text-zinc-200">{r.clientsCreated}</dd>
                            </div>
                            <div className="flex justify-between gap-2 border-b border-zinc-800/80 pb-1 sm:border-0 sm:pb-0">
                              <dt>{t('thCaTicket')}</dt>
                              <dd className="tabular-nums text-zinc-200">{formatPilotageEur(r.revenueCents, locale)}</dd>
                            </div>
                            <div className="flex justify-between gap-2 border-b border-zinc-800/80 pb-1 sm:border-0 sm:pb-0">
                              <dt>{t('thPanierAvg')}</dt>
                              <dd className="tabular-nums text-zinc-200">{formatPilotageEur(r.avgBasketCents, locale)}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                              <dt>{t('thAvisGoogle')}</dt>
                              <dd className="tabular-nums text-zinc-200 inline-flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-hidden />
                                {r.googlePositiveReviews}
                              </dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {staffRows.length > STAFF_TABLE_PAGE ? (
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                <button
                  type="button"
                  disabled={staffPageIdx <= 0}
                  onClick={() => setStaffPageIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t('pagePrev')}
                </button>
                <span className="tabular-nums">
                  {t('staffPageInfo', {
                    current: staffPageIdx + 1,
                    total: staffPageCount,
                    n: staffRows.length,
                  })}
                </span>
                <button
                  type="button"
                  disabled={staffPageIdx >= staffPageCount - 1}
                  onClick={() => setStaffPageIdx((i) => Math.min(staffPageCount - 1, i + 1))}
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                >
                  {t('pageNext')}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : null}
          </div>
        )}
        {staffStatsDisclaimer ? (
          <p className="text-[11px] text-zinc-400 leading-snug">{staffStatsDisclaimer}</p>
        ) : null}
      </section>
      </PilotageSection>

      <PilotageSection id="pilotage-activity" title={t('pilotageSectionActivityTitle')}>
        <section
          className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-3 shadow-lg shadow-black/25 ring-1 ring-white/5"
          aria-label={t('ariaActivityFeed')}
        >
          <div className="flex items-center gap-2 text-zinc-100">
            <MessageCircle className="w-5 h-5 shrink-0 text-amber-400" aria-hidden />
            <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">{t('activityTitle')}</h3>
          </div>
          {activityLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('loading')}
            </div>
          ) : groupedActivityLines.length === 0 ? (
            <p className="text-sm text-zinc-400">{t('noActivityLines')}</p>
          ) : (
            <>
              <ul className="space-y-2 max-h-[min(420px,50vh)] overflow-y-auto text-sm text-zinc-100 pr-1">
                {groupedActivityLines.map((g) => (
                  <li
                    key={g.key}
                    className="rounded-[14px] border border-zinc-600/45 bg-zinc-800/50 px-3 py-2.5 leading-snug shadow-sm shadow-black/15"
                  >
                    <p className="font-medium text-zinc-100">{g.displayLine}</p>
                    {g.detailLines.length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-zinc-600/40">
                        <button
                          type="button"
                          onClick={() =>
                            setActivityDetailKey((k) => (k === g.key ? null : g.key))
                          }
                          className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 hover:underline"
                        >
                          {activityDetailKey === g.key
                            ? t('activityGroupDetailsHide')
                            : t('activityGroupDetailsShow')}
                        </button>
                        {activityDetailKey === g.key ? (
                          <ul className="mt-2 space-y-1 pl-2 border-l border-amber-500/30 text-xs text-zinc-400">
                            {g.detailLines.map((line, li) => (
                              <li key={`${g.key}-${li}`}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-zinc-600/50">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={activityLoading || activityPageIdx <= 0}
                    onClick={() => setActivityPageIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('activityNewer')}
                  </button>
                  <button
                    type="button"
                    disabled={activityLoading || !activityHasOlder}
                    onClick={() => setActivityPageIdx((i) => i + 1)}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                  >
                    {t('activityOlder')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 text-center sm:text-right tabular-nums">
                  {t('activityPageInfo', {
                    current: currentActivityPage,
                    total: activityPageCount,
                    n: activityTotal,
                  })}
                </p>
              </div>
            </>
          )}
        </section>
      </PilotageSection>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 py-12">
          <Loader2 className="w-6 h-6 animate-spin shrink-0" />
          <span className="text-sm">{t('calculating')}</span>
        </div>
      ) : err ? (
        <div className="rounded-[14px] border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-200">
          {err}
        </div>
      ) : data ? (
        <PilotageSection id="pilotage-commerce" title={t('pilotageSectionCommerceTitle')}>
          <section
            className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-4 w-full min-w-0 shadow-lg shadow-black/25 ring-1 ring-white/5"
            aria-label={t('loyaltyProgramTitle')}
          >
            <h3 className="text-sm font-bold text-zinc-50 uppercase tracking-wide">
              {t('loyaltyProgramTitle')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(
                [
                  [t('loyaltyColDay'), data.loyaltyProgramKpis.day] as const,
                  [t('loyaltyColWeek'), data.loyaltyProgramKpis.week] as const,
                  [t('loyaltyColMonth'), data.loyaltyProgramKpis.month] as const,
                ] as const
              ).map(([colLabel, kpi], kpiIdx) => (
                <div
                  key={kpiIdx}
                  className="rounded-[14px] border border-zinc-600/45 bg-zinc-800/45 p-4 space-y-2 shadow-sm shadow-black/15"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    {colLabel}
                  </p>
                  <dl className="space-y-1.5 text-sm text-zinc-100">
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-400">{t('loyaltyPoints')}</dt>
                      <dd className="tabular-nums font-semibold text-zinc-50">{kpi.pointsDistributed}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-400">{t('loyaltyStamps')}</dt>
                      <dd className="tabular-nums font-semibold text-zinc-50">{kpi.stampsEarned}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-zinc-400">{t('loyaltyVouchers')}</dt>
                      <dd className="tabular-nums font-semibold text-zinc-50">{kpi.vouchersGenerated}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[14px] border border-zinc-600/55 bg-zinc-900/90 p-4 sm:p-5 space-y-4 w-full min-w-0 shadow-lg shadow-black/25 ring-1 ring-white/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-zinc-50 uppercase tracking-wide">
                  {t('cashDailyTitle')}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-2xl">
                  {t('cashDailySubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCashExplorerOpen(true)}
                className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3 rounded-[14px] border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 shrink-0 shadow-sm shadow-black/20"
              >
                <CalendarRange className="w-4 h-4 shrink-0 opacity-80" />
                {t('cashHistoryBtn')}
              </button>
            </div>
            {(() => {
              const rows = data.dailyActivity;
              const pageCount = Math.max(1, Math.ceil(rows.length / CAISSE_TABLE_PAGE));
              const safePage = Math.min(Math.max(0, caissePageIdx), pageCount - 1);
              const slice = rows.slice(
                safePage * CAISSE_TABLE_PAGE,
                safePage * CAISSE_TABLE_PAGE + CAISSE_TABLE_PAGE
              );
              return (
                <>
                  <div className="overflow-x-auto rounded-[14px] border border-zinc-600/50 bg-zinc-800/40">
                    <table className="w-full text-left text-xs sm:text-sm min-w-[760px]">
                      <thead className="bg-zinc-800/90 text-[10px] sm:text-xs uppercase tracking-wide text-zinc-300">
                        <tr>
                          <th className="px-3 py-2 font-semibold">{t('thDay')}</th>
                          <th className="px-3 py-2 font-semibold text-right tabular-nums">{t('thPassages')}</th>
                          <th className="px-3 py-2 font-semibold text-right tabular-nums">{t('thCa')}</th>
                          <th className="px-3 py-2 font-semibold text-right tabular-nums">{t('thPanier')}</th>
                          <th className="px-3 py-2 font-semibold text-right tabular-nums">{t('thArticles')}</th>
                          <th className="px-3 py-2 font-semibold min-w-[200px]">{t('thTopLabels')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700/50">
                        {slice.map((row) => (
                          <tr
                            key={row.dateKey}
                            className={
                              row.visitCount === 0 && row.revenueCents === 0
                                ? 'text-zinc-500'
                                : 'text-zinc-100'
                            }
                          >
                            <td className="px-3 py-2.5 font-medium">{row.labelFr}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{row.visitCount}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {row.revenueCents > 0 ? formatPilotageEur(row.revenueCents, locale) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {row.avgBasketCents != null
                                ? formatPilotageEur(row.avgBasketCents, locale)
                                : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {row.itemsSold != null ? row.itemsSold : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-[11px] sm:text-xs leading-snug">
                              {row.topLabels.length > 0
                                ? row.topLabels.map((l, li) => (
                                    <span key={`${row.dateKey}-${l.text}-${li}`}>
                                      {li > 0 ? t('topLabelSep') : ''}
                                      {t('topLabelItem', { text: l.text, count: l.count })}
                                    </span>
                                  ))
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > CAISSE_TABLE_PAGE ? (
                    <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
                      <button
                        type="button"
                        disabled={safePage <= 0}
                        onClick={() => setCaissePageIdx(safePage - 1)}
                        className="min-h-[36px] px-2.5 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 font-semibold disabled:opacity-40"
                      >
                        {t('pagePrev')}
                      </button>
                      <span className="tabular-nums text-center shrink-0">
                        {t('caissePageInfo', {
                          current: safePage + 1,
                          total: pageCount,
                          n: rows.length,
                        })}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= pageCount - 1}
                        onClick={() => setCaissePageIdx(safePage + 1)}
                        className="min-h-[36px] px-2.5 rounded-[14px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 font-semibold disabled:opacity-40"
                      >
                        {t('pageNext')}
                      </button>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </section>
        </PilotageSection>
      ) : null}
      </div>
      <ArchivesDrawer
        open={archivesOpen}
        onClose={() => setArchivesOpen(false)}
        locale={locale}
        voucherMonthArchives={voucherMonthArchives}
        traceabilityMonthLinks={traceabilityMonthLinks}
        archiveExportYear={archiveExportYear}
        archiveExportMonth={archiveExportMonth}
        onArchiveExportYear={setArchiveExportYear}
        onArchiveExportMonth={setArchiveExportMonth}
        reports={data?.reports ?? []}
        onRefreshVoucherArchives={loadVoucherMonthArchives}
      />
      <PilotageDailyCashExplorer open={cashExplorerOpen} onClose={() => setCashExplorerOpen(false)} />
    </div>
  );
}
