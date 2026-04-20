'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, format, getISODay, startOfWeek } from 'date-fns';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTheme } from 'next-themes';
import { Activity, Archive, CalendarDays, ChevronLeft, ChevronRight, Download, Printer, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type SupabaseBrowser = ReturnType<typeof createClient>;
type RealtimeChannelHandle = ReturnType<SupabaseBrowser['channel']>;

type FlowTranslate = (key: string, values?: Record<string, string | number | boolean>) => string;

export type FlowPoint = {
  id: string;
  at: string;
  minutesFromMidnight: number;
  amountEuro: number | null;
  eventType: string;
  servedByName: string | null;
};

type FlowPayload = {
  timeZone: string;
  day: string;
  windowStartHour: number;
  windowEndHour: number;
  activeStaffCount: number;
  points: FlowPoint[];
  autoArchiveMonthly?: boolean;
};

type MonthSummaryPayload = {
  timeZone: string;
  month: string;
  days: { day: string; count: number; amountEuroSum: number | null }[];
  archivedAt: string | null;
  autoArchiveMonthly: boolean;
};

const EMPTY_FLOW_POINTS: FlowPoint[] = [];
const DAY_LIST_PAGE_SIZE = 25;

function stableJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (h % 100) + 0.5;
}

function useChartPoints(raw: FlowPoint[] | undefined, windowStart: number, windowEnd: number) {
  return useMemo(() => {
    const list = raw ?? EMPTY_FLOW_POINTS;
    const startM = windowStart * 60;
    const endM = windowEnd * 60;
    return list
      .filter((p) => p.minutesFromMidnight >= startM && p.minutesFromMidnight <= endM)
      .map((p) => ({
        ...p,
        x: p.minutesFromMidnight,
        y: stableJitter(p.id),
      }));
  }, [raw, windowStart, windowEnd]);
}

function FlowTooltipBody({
  active,
  payload,
  formatTime,
  formatEuro,
  eventLabel,
  t,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  formatTime: (iso: string) => string;
  formatEuro: (n: number) => string;
  eventLabel: (type: string) => string;
  t: FlowTranslate;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as FlowPoint & { x: number; y: number };
  if (!row?.id) return null;
  const shortId = row.id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const amountLine =
    row.amountEuro != null && Number.isFinite(row.amountEuro)
      ? formatEuro(row.amountEuro)
      : null;
  const by = row.servedByName?.trim() ? row.servedByName.trim() : t('tooltipUnknownStaff');
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg max-w-[260px]">
      <div className="font-semibold text-slate-900 dark:text-zinc-100">
        {t('tooltipTicket', { id: shortId })}
      </div>
      <div className="mt-1 text-slate-600 dark:text-zinc-400">
        {formatTime(row.at)} · {eventLabel(row.eventType)}
      </div>
      {amountLine && (
        <div className="mt-0.5 text-slate-700 dark:text-zinc-300">
          {t('tooltipAmount', { amount: amountLine })}
        </div>
      )}
      <div className="mt-1 text-slate-600 dark:text-zinc-400">
        {t('tooltipBy', { name: by })}
      </div>
    </div>
  );
}

function buildAdvisor(points: FlowPoint[], activeStaff: number, t: FlowTranslate): { badge: string; lines: string[] } {
  const total = points.length;
  const ratio = total / Math.max(activeStaff, 1);

  const buckets = Array.from({ length: 24 }, () => 0);
  for (const p of points) {
    const h = Math.floor(p.minutesFromMidnight / 60);
    if (h >= 0 && h < 24) buckets[h] += 1;
  }
  let peakH = 0;
  let peakC = 0;
  for (let h = 0; h < 24; h += 1) {
    if (buckets[h] > peakC) {
      peakC = buckets[h];
      peakH = h;
    }
  }

  const peakLabel = t('peakWindow', { start: peakH, end: peakH + 1 });

  if (activeStaff === 0) {
    if (total === 0) {
      return {
        badge: t('statusQuiet'),
        lines: [t('insightEmpty')],
      };
    }
    return {
      badge: t('statusUnderstaffed'),
      lines: [t('insightNoStaff', { count: total })],
    };
  }

  if (ratio >= 18) {
    const lines = [t('insightUnderstaffed', { ratio: Math.round(ratio * 10) / 10 })];
    if (peakC > 0) lines.push(t('insightPeak', { window: peakLabel, count: peakC }));
    return { badge: t('statusUnderstaffed'), lines };
  }

  if (ratio >= 12) {
    return {
      badge: t('statusTight'),
      lines: [t('insightTight', { ratio: Math.round(ratio * 10) / 10 })],
    };
  }

  if (total >= 4 && activeStaff >= 4 && ratio < 4) {
    return {
      badge: t('statusOverstaffed'),
      lines: [t('insightOverstaffed', { staff: activeStaff, count: total })],
    };
  }

  if (total > 0 && peakC >= Math.max(3, Math.ceil(total * 0.35))) {
    return {
      badge: t('statusOptimized'),
      lines: [t('insightPeak', { window: peakLabel, count: peakC }), t('insightBalanced')],
    };
  }

  return {
    badge: t('statusOptimized'),
    lines: [t('insightBalanced')],
  };
}

function daysYmList(ym: string): string[] {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function TransactionFlowPanel() {
  const t = useTranslations('Dashboard.flowAnalytics');
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<FlowPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthSummary, setMonthSummary] = useState<MonthSummaryPayload | null>(null);
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [autoArchiveMonthly, setAutoArchiveMonthly] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [counterBusy, setCounterBusy] = useState(false);
  const [dayListPage, setDayListPage] = useState(0);

  const live = true;
  const channelRef = useRef<RealtimeChannelHandle | null>(null);
  const selectedDayRef = useRef(selectedDay);
  const viewMonthRef = useRef(viewMonth);
  selectedDayRef.current = selectedDay;
  viewMonthRef.current = viewMonth;

  const loadMonthSummary = useCallback(async (monthYm: string) => {
    setMonthLoading(true);
    try {
      const res = await fetch(`/api/dashboard/transaction-flow?summaryMonth=${encodeURIComponent(monthYm)}`, {
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => ({}))) as MonthSummaryPayload & { error?: string };
      if (!res.ok) throw new Error('month');
      setMonthSummary(json);
      setAutoArchiveMonthly(json.autoArchiveMonthly === true);
    } catch {
      setMonthSummary(null);
    } finally {
      setMonthLoading(false);
    }
  }, []);

  const loadDay = useCallback(
    async (explicitDay?: string): Promise<string | null> => {
      try {
        const q = explicitDay ? `?day=${encodeURIComponent(explicitDay)}` : '';
        const res = await fetch(`/api/dashboard/transaction-flow${q}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => ({}))) as FlowPayload & { error?: string };
        if (!res.ok) throw new Error('load');
        setData({
          timeZone: json.timeZone,
          day: json.day,
          windowStartHour: json.windowStartHour ?? 8,
          windowEndHour: json.windowEndHour ?? 23,
          activeStaffCount: json.activeStaffCount ?? 0,
          points: Array.isArray(json.points) ? json.points : [],
          autoArchiveMonthly: json.autoArchiveMonthly,
        });
        setSelectedDay(json.day);
        if (json.autoArchiveMonthly != null) setAutoArchiveMonthly(json.autoArchiveMonthly);
        if (!explicitDay) {
          setViewMonth(json.day.slice(0, 7));
        }
        return json.day;
      } catch {
        setData(null);
        return null;
      }
    },
    []
  );

  const refreshAll = useCallback(async () => {
    const day = selectedDayRef.current;
    const month = viewMonthRef.current;
    await loadDay(day || undefined);
    await loadMonthSummary(month);
  }, [loadDay, loadMonthSummary]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const day = await loadDay();
      if (day) {
        await loadMonthSummary(day.slice(0, 7));
      }
      setLoading(false);
    })();
  }, [loadDay, loadMonthSummary]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const ch = supabase.channel(`banano-loyalty-flow-${user.id}`).on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'banano_loyalty_events',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void refreshAll();
        }
      );
      if (cancelled) {
        supabase.removeChannel(ch);
        return;
      }
      channelRef.current = ch;
      ch.subscribe();
    })();
    const poll = window.setInterval(() => void refreshAll(), 45000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      const ch = channelRef.current;
      channelRef.current = null;
      if (ch) supabase.removeChannel(ch);
    };
  }, [refreshAll]);

  const tz = monthSummary?.timeZone ?? data?.timeZone ?? 'Europe/Paris';

  const dayCounts = useMemo(() => {
    const m = new Map<string, { count: number; amountEuroSum: number | null }>();
    for (const d of monthSummary?.days ?? []) {
      m.set(d.day, { count: d.count, amountEuroSum: d.amountEuroSum });
    }
    return m;
  }, [monthSummary?.days]);

  const calendarDays = useMemo(() => daysYmList(viewMonth), [viewMonth]);
  const leadingBlanks = useMemo(() => {
    if (!calendarDays.length) return 0;
    const first = fromZonedTime(`${calendarDays[0]}T12:00:00`, tz);
    return getISODay(first) - 1;
  }, [calendarDays, tz]);

  const weekdayLabels = useMemo(() => {
    const dfLocale = dateFnsLocaleForApp(locale);
    const monday = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'EEE', { locale: dfLocale }));
  }, [locale]);

  const onPickDay = (ymd: string) => {
    setSelectedDay(ymd);
    void (async () => {
      setLoading(true);
      await loadDay(ymd);
      setLoading(false);
    })();
  };

  const onShiftMonth = (delta: number) => {
    const next = shiftYm(viewMonth, delta);
    setViewMonth(next);
    void loadMonthSummary(next);
    if (!selectedDay.startsWith(`${next}-`)) {
      const first = `${next}-01`;
      setSelectedDay(first);
      void (async () => {
        setLoading(true);
        await loadDay(first);
        setLoading(false);
      })();
    }
  };

  const onDownloadMonth = () => {
    window.open(`/api/dashboard/transaction-flow/export?month=${encodeURIComponent(viewMonth)}`, '_blank', 'noopener');
  };

  const onMarkArchive = async () => {
    setArchiveBusy(true);
    try {
      const res = await fetch('/api/dashboard/transaction-flow/archive-mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: viewMonth }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('archive');
      toast.success(t('toastArchiveMarked'));
      await loadMonthSummary(viewMonth);
    } catch {
      toast.error(t('toastArchiveError'));
    } finally {
      setArchiveBusy(false);
    }
  };

  const onToggleAutoArchive = async () => {
    setSettingsSaving(true);
    const next = !autoArchiveMonthly;
    try {
      const res = await fetch('/api/dashboard/transaction-flow/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoArchiveMonthly: next }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('settings');
      setAutoArchiveMonthly(next);
      toast.success(t('toastSettingsSaved'));
    } catch {
      toast.error(t('toastSettingsError'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const onCounterPdf = () => {
    window.open('/api/banano/loyalty/counter-stand-pdf', '_blank', 'noopener');
  };

  const onOrderCounter = async () => {
    setCounterBusy(true);
    try {
      const res = await fetch(`/api/stripe/create-counter-stand-checkout?locale=${encodeURIComponent(locale)}`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 503) {
        toast.message(t('counterOrderUnavailable'));
        return;
      }
      if (!res.ok || !json.url) throw new Error('checkout');
      window.location.href = json.url as string;
    } catch {
      toast.error(t('counterOrderError'));
    } finally {
      setCounterBusy(false);
    }
  };

  const windowStart = data?.windowStartHour ?? 8;
  const windowEnd = data?.windowEndHour ?? 23;
  const chartPoints = useChartPoints(data?.points, windowStart, windowEnd);
  const axisDomain: [number, number] = [windowStart * 60, windowEnd * 60];

  const advisor = useMemo(
    () => buildAdvisor(data?.points ?? [], data?.activeStaffCount ?? 0, t),
    [data?.points, data?.activeStaffCount, t]
  );

  const gridStroke = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const primary = '#2563eb';

  const formatTime = useCallback(
    (iso: string) => {
      const z = data?.timeZone ?? tz;
      try {
        return formatInTimeZone(new Date(iso), z, 'HH:mm', { locale: undefined });
      } catch {
        return iso;
      }
    },
    [data?.timeZone, tz]
  );

  const formatEuro = useCallback(
    (n: number) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(
        n
      ),
    [locale]
  );

  const eventLabel = useCallback(
    (type: string) => {
      switch (type) {
        case 'earn_points':
          return t('event_earn_points');
        case 'earn_stamps':
          return t('event_earn_stamps');
        case 'redeem_points':
          return t('event_redeem_points');
        case 'redeem_stamps':
          return t('event_redeem_stamps');
        case 'encaisser_reward':
          return t('event_encaisser_reward');
        case 'voucher_redeemed':
          return t('event_voucher_redeemed');
        case 'member_created':
          return t('event_member_created');
        case 'voucher_issued':
          return t('event_voucher_issued');
        case 'staff_allowance_issued':
          return t('event_staff_allowance_issued');
        case 'staff_allowance_debit':
          return t('event_staff_allowance_debit');
        case 'staff_allowance_merchant_adjust':
          return t('event_staff_allowance_merchant_adjust');
        default:
          return t('event_other');
      }
    },
    [t]
  );

  const tickFormatter = useCallback((v: number) => {
    const h = Math.floor(v / 60);
    const m = v % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  }, []);

  const sortedPoints = useMemo(() => {
    const pts = [...(data?.points ?? [])];
    pts.sort((a, b) => a.at.localeCompare(b.at));
    return pts;
  }, [data?.points]);

  useEffect(() => {
    setDayListPage(0);
  }, [data?.day]);

  useEffect(() => {
    const maxP = Math.max(0, Math.ceil(sortedPoints.length / DAY_LIST_PAGE_SIZE) - 1);
    setDayListPage((p) => (p > maxP ? maxP : p));
  }, [sortedPoints.length]);

  const isViewingToday = useMemo(() => {
    if (!data?.day) return true;
    try {
      const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
      return data.day === today;
    } catch {
      return true;
    }
  }, [data?.day, tz]);

  const dayListMaxPage = Math.max(0, Math.ceil(sortedPoints.length / DAY_LIST_PAGE_SIZE) - 1);
  const safeDayListPage = Math.min(dayListPage, dayListMaxPage);
  const dayListSlice = sortedPoints.slice(
    safeDayListPage * DAY_LIST_PAGE_SIZE,
    (safeDayListPage + 1) * DAY_LIST_PAGE_SIZE
  );
  const dayListTotal = sortedPoints.length;
  const dayListFrom = dayListTotal === 0 ? 0 : safeDayListPage * DAY_LIST_PAGE_SIZE + 1;
  const dayListTo = Math.min(dayListTotal, (safeDayListPage + 1) * DAY_LIST_PAGE_SIZE);

  const archivedLabel = monthSummary?.archivedAt
    ? formatInTimeZone(new Date(monthSummary.archivedAt), tz, 'PPp', { locale: undefined })
    : null;

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-2xl text-slate-900 dark:text-slate-50">
              {t('title')}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                live
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-500/15 text-slate-600'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`}
                aria-hidden
              />
              {t('liveBadge')}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">{t('description')}</p>
          {data?.day && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {t('dayLabel', { day: data.day })} · {t('windowLabel', { start: windowStart, end: windowEnd })} ·{' '}
              {data.timeZone}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 px-4 py-3 min-w-[140px]">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('ticketsToday')}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? '…' : data?.points.length ?? 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 px-4 py-3 min-w-[140px]">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('staffActive')}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {loading ? '…' : data?.activeStaffCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{t('staffActiveHint')}</div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary shrink-0" aria-hidden />
            <h2 className="font-semibold text-slate-900 dark:text-slate-50">{t('calendarTitle')}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onShiftMonth(-1)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-700 p-2 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
              aria-label={t('monthPrevAria')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-zinc-100 min-w-[7.5rem] text-center">
              {viewMonth}
            </span>
            <button
              type="button"
              onClick={() => onShiftMonth(1)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-zinc-700 p-2 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
              aria-label={t('monthNextAria')}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDownloadMonth}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <Download className="h-3.5 w-3.5" />
              {t('downloadMonthCsv')}
            </button>
            <button
              type="button"
              disabled={archiveBusy || monthLoading}
              onClick={() => void onMarkArchive()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100/90 dark:hover:bg-amber-950/50 disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              {t('archiveMonthBtn')}
            </button>
          </div>
        </div>

        {archivedLabel && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {t('archiveBadge', { date: archivedLabel })}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-slate-50/80 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800 p-3">
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoArchiveMonthly}
              disabled={settingsSaving}
              onChange={() => void onToggleAutoArchive()}
              className="mt-1 rounded border-slate-300"
            />
            <span>
              <span className="font-medium block">{t('autoArchiveLabel')}</span>
              <span className="text-xs text-slate-500 dark:text-zinc-500">{t('autoArchiveHint')}</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCounterPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563eb] text-white px-3 py-2 text-xs font-semibold hover:brightness-110"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('counterPdfBtn')}
            </button>
            <button
              type="button"
              disabled={counterBusy}
              onClick={() => void onOrderCounter()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {t('counterOrderBtn')}
            </button>
          </div>
        </div>

        {monthLoading ? (
          <p className="text-sm text-slate-500">{t('fetching')}</p>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
            {weekdayLabels.map((w, i) => (
              <div key={`dow-${i}`} className="py-1">
                {w}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[3rem]" />
            ))}
            {calendarDays.map((ymd) => {
              const info = dayCounts.get(ymd);
              const count = info?.count ?? 0;
              const sel = selectedDay === ymd;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => onPickDay(ymd)}
                  className={`min-h-[3rem] rounded-xl border text-xs font-semibold transition-colors ${
                    sel
                      ? 'border-[#2563eb] bg-[#2563eb]/10 text-[#2563eb] dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-200'
                      : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 hover:border-slate-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className="pt-1 tabular-nums">{parseInt(ymd.slice(8, 10), 10)}</div>
                  <div className={`text-[10px] font-medium ${count > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {count > 0 ? t('dayPassagesShort', { count }) : '—'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!monthLoading && (
          <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed max-w-3xl">{t('calendarLegend')}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">{t('chartTitle')}</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed max-w-3xl mb-3">{t('chartIntro')}</p>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 mb-4">
          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: primary }} aria-hidden />
          <span>{t('chartLegendSample')}</span>
        </div>
        {!loading && chartPoints.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('chartEmpty')}</p>
        )}
        <div className="w-full h-[320px] sm:h-[380px]" aria-label={t('chartAria')}>
          {!mounted || loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">{t('fetching')}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={axisDomain}
                  tickFormatter={tickFormatter}
                  stroke={resolvedTheme === 'dark' ? '#a1a1aa' : '#64748b'}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis type="number" dataKey="y" domain={[0, 100]} hide />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={(tipProps) => (
                    <FlowTooltipBody
                      active={tipProps.active}
                      payload={tipProps.payload}
                      formatTime={formatTime}
                      formatEuro={formatEuro}
                      eventLabel={eventLabel}
                      t={t as FlowTranslate}
                    />
                  )}
                />
                <Scatter
                  name="tickets"
                  data={chartPoints}
                  fill={primary}
                  isAnimationActive
                  animationDuration={450}
                />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 p-4 sm:p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 dark:text-slate-50 mb-2">{t('dayListTitle')}</h2>
        {!isViewingToday && data?.day && (
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 rounded-lg px-3 py-2 mb-3">
            {t('dayListHistoricalBanner')}
          </p>
        )}
        {sortedPoints.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('dayListEmpty')}</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <p className="text-xs text-slate-500 dark:text-zinc-500 tabular-nums">
                {t('dayListPageInfo', { from: dayListFrom, to: dayListTo, total: dayListTotal })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeDayListPage <= 0}
                  onClick={() => setDayListPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {t('dayListPagePrev')}
                </button>
                <button
                  type="button"
                  disabled={safeDayListPage >= dayListMaxPage}
                  onClick={() => setDayListPage((p) => Math.min(dayListMaxPage, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {t('dayListPageNext')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">{t('tableTime')}</th>
                    <th className="py-2 pr-3">{t('tableEvent')}</th>
                    <th className="py-2 pr-3">{t('tableAmount')}</th>
                    <th className="py-2">{t('tableStaff')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dayListSlice.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-zinc-800/80">
                      <td className="py-2 pr-3 font-mono text-xs">{formatTime(p.at)}</td>
                      <td className="py-2 pr-3">{eventLabel(p.eventType)}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {p.amountEuro != null && Number.isFinite(p.amountEuro) ? formatEuro(p.amountEuro) : '—'}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-zinc-400">
                        {p.servedByName?.trim() || t('tooltipUnknownStaff')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-gradient-to-br from-slate-50 to-white dark:from-zinc-900/80 dark:to-zinc-950 p-4 sm:p-6 shadow-sm">
        <h2 className="font-display font-semibold text-lg text-slate-900 dark:text-slate-50">{t('advisorTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('advisorSubtitle')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
            {advisor.badge}
          </span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
          {advisor.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
