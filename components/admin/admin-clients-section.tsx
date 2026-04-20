'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Shield,
  Users,
  Search,
  X,
  Loader2,
  Radio,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AdminClientDetailSheet } from '@/components/admin/admin-client-detail-sheet';
import { AdminGuidePanel } from '@/components/admin/admin-guide-panel';
import { AdminClientUsageSparkline } from '@/components/admin/admin-client-usage-sparkline';
import { useFormatter, useTranslations } from 'next-intl';
import type { DateTimeFormatOptions } from 'use-intl';

type PriorityFilter = 'all' | '100' | '50' | '0';

type ClientRow = {
  id: string;
  full_name: string | null;
  establishment_name: string | null;
  email: string | null;
  phone: string | null;
  /** Même champ que dans la fiche client (`profiles.locale`). */
  locale: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  created_at: string | null;
  role: string | null;
  priority_score?: number;
  last_priority_update?: string | null;
  security_alert?: boolean;
  usage_series?: number[];
};

type AdminClientCursor = {
  priority_score: number;
  created_at: string;
  id: string;
};

type ClientsApiResponse = {
  clients: ClientRow[];
  total: number;
  perPage: number;
  nextCursor: AdminClientCursor | null;
  priorityFilter?: string;
  error?: string;
};

const PLAN_COLORS: Record<string, string> = {
  vision: 'text-slate-300 bg-slate-800 border-slate-700',
  starter: 'text-slate-300 bg-slate-800 border-slate-700',
  free: 'text-slate-400 bg-slate-800/50 border-slate-700/50',
  pulse: 'text-blue-300 bg-blue-900/30 border-blue-800/50',
  manager: 'text-blue-300 bg-blue-900/30 border-blue-800/50',
  zenith: 'text-violet-300 bg-violet-900/30 border-violet-800/50',
  Dominator: 'text-violet-300 bg-violet-900/30 border-violet-800/50',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400 bg-emerald-900/20 border-emerald-800/50',
  trialing: 'text-amber-400 bg-amber-900/20 border-amber-800/50',
  past_due: 'text-red-400 bg-red-900/20 border-red-800/50',
  canceled: 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50',
  incomplete: 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50',
  pending: 'text-sky-400 bg-sky-900/20 border-sky-800/50',
  expired: 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50',
};

const INFINITE_PER_PAGE = 80;
const DEBOUNCE_MS = 350;
const DEFAULT_PLAN_KEY = 'free';
const ZEBRA_ROW_CLASS: [string, string] = ['bg-zinc-950/60', 'bg-zinc-900/22'];
const DEFAULT_STATUS_ROW_CLASS = 'text-zinc-500 bg-zinc-800/30 border-zinc-700/50';
const CLIENT_TABLE_DATE_FMT: DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};
/** Ligne établissement + ligne Prénom/Nom — avec email/tél. complets (wrap possible). */
/** Hauteur estimée par ligne (virtualisation) — texte plus grand, centrage vertical. */
const ROW_H = 108;
/** Largeur minimum du tableau (scroll horizontal sur petit écran) ; au-delà les colonnes fluides remplissent l’espace. */
const TABLE_MIN_W = 880;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Découpe courante : premier mot = prénom, reste = nom (donnée source = full_name). */
function splitGivenFamily(fullName: string | null | undefined): { given: string; family: string | null } | null {
  const t = fullName?.trim();
  if (!t) return null;
  const i = t.indexOf(' ');
  if (i === -1) return { given: t, family: null };
  return { given: t.slice(0, i), family: t.slice(i + 1).trim() || null };
}

function CrisisPulseDot({ title }: { title: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0" title={title}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.85)]" />
    </span>
  );
}

type AdminClientsSectionProps = {
  /** Hauteur max. du tableau scrollable (page dédiée = plus grand). */
  listMaxHeightClass?: string;
};

export function AdminClientsSection({ listMaxHeightClass = 'max-h-[min(72vh,720px)]' }: AdminClientsSectionProps = {}) {
  const t = useTranslations('Dashboard.adminClientsSection');
  const format = useFormatter();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const planLabel = useCallback(
    (planKey: string) => {
      const k = `plan_${planKey}`;
      if (
        [
          'plan_vision',
          'plan_pulse',
          'plan_zenith',
          'plan_starter',
          'plan_manager',
          'plan_Dominator',
          'plan_free',
        ].includes(k)
      ) {
        return t(k as 'plan_vision');
      }
      return planKey;
    },
    [t],
  );

  const statusLabelFn = useCallback(
    (statusKey: string) => {
      if (!statusKey) return '';
      const k = `status_${statusKey}`;
      if (
        [
          'status_active',
          'status_trialing',
          'status_past_due',
          'status_canceled',
          'status_incomplete',
          'status_pending',
          'status_expired',
        ].includes(k)
      ) {
        return t(k as 'status_active');
      }
      return statusKey;
    },
    [t],
  );

  const formatLocaleCell = useCallback(
    (raw: string | null | undefined) => {
      if (raw == null || String(raw).trim() === '') return t('dashEmpty');
      const code = String(raw).trim().toLowerCase().slice(0, 8);
      const known = ['fr', 'en', 'es', 'de', 'it', 'ja', 'pt', 'zh'] as const;
      if ((known as readonly string[]).includes(code)) {
        return t(`loc_${code}` as 'loc_fr');
      }
      const short = code.toUpperCase().slice(0, 2);
      return short || t('dashEmpty');
    },
    [t],
  );
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, DEBOUNCE_MS);
  /**
   * Préremplit la recherche depuis `?clients_q=` (lien « Trouver dans Clients »), puis enlève ce paramètre de l’URL
   * pour qu’un F5 ne réinjecte pas l’e-mail. Le hash (#admin-clients) est conservé.
   */
  useEffect(() => {
    const q = searchParams.get('clients_q')?.trim() ?? '';
    if (!q) return;
    setSearchInput(q);
    if (typeof window === 'undefined') return;
    const u = new URL(window.location.href);
    if (!u.searchParams.has('clients_q')) return;
    u.searchParams.delete('clients_q');
    router.replace(u.pathname + u.search + u.hash, { scroll: false });
  }, [searchParams, router]);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [detailEstablishmentLabel, setDetailEstablishmentLabel] = useState<string | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ['admin-clients', debouncedSearch, priorityFilter],
    initialPageParam: null as AdminClientCursor | null,
    queryFn: async ({ pageParam }: { pageParam: AdminClientCursor | null }) => {
      const params = new URLSearchParams({
        perPage: String(INFINITE_PER_PAGE),
      });
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (pageParam) {
        params.set('afterPriority', String(pageParam.priority_score));
        params.set('afterCreatedAt', pageParam.created_at);
        params.set('afterId', pageParam.id);
      }
      const res = await fetch(`/api/admin/clients?${params.toString()}`, { credentials: 'same-origin' });
      const json = (await res.json()) as ClientsApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const flatClients = useMemo(() => data?.pages.flatMap((p) => p.clients) ?? [], [data]);
  const total = data?.pages[0]?.total ?? 0;

  const virtualizer = useVirtualizer({
    count: flatClients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });

  const onScrollLoadMore = useCallback(() => {
    const el = parentRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 480) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScrollLoadMore, { passive: true });
    return () => el.removeEventListener('scroll', onScrollLoadMore);
  }, [onScrollLoadMore]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-profiles-priority')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const summaryLine = useMemo(() => {
    if (isLoading && !data) return null;
    if (total === 0) return t('summaryZero');
    const loaded = flatClients.length;
    const q = debouncedSearch.trim();
    if (q) {
      const shortQ = q.length > 48 ? `${q.slice(0, 48)}…` : q;
      return t('summaryWithSearch', { loaded, total, q: shortQ });
    }
    return t('summaryNoSearch', { loaded, total });
  }, [isLoading, data, total, flatClients.length, debouncedSearch, t]);

  const showEmptySearch =
    !isLoading && !isError && total === 0 && debouncedSearch.trim().length > 0;
  const showEmptyGlobal =
    !isLoading && !isError && total === 0 && debouncedSearch.trim().length === 0;

  const badgeBase =
    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors';

  return (
    <section>
      <AdminClientDetailSheet
        clientId={detailClientId}
        establishmentLabel={detailEstablishmentLabel}
        onClose={() => {
          setDetailClientId(null);
          setDetailEstablishmentLabel(null);
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-600" />
            {t('title')}
            {!isLoading && data != null && (
              <span className="text-zinc-600 font-mono normal-case">({total})</span>
            )}
          </h2>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400/90"
            title={t('realtimeTitle')}
          >
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" aria-hidden />
            {t('realtimeBadge')}
          </span>
        </div>

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 pl-10 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
            aria-label={t('searchAria')}
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title={t('clearSearchTitle')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <AdminGuidePanel title={t('guideTitle')} variant="compact">
          <ul className="list-disc pl-4 space-y-1.5">
            <li>
              {t.rich('guideSearchRich', {
                strong: (c) => <strong className="text-zinc-300">{c}</strong>,
              })}
            </li>
            <li>
              {t.rich('guideFiltersRich', {
                strong: (c) => <strong className="text-zinc-300">{c}</strong>,
              })}
            </li>
            <li>
              {t.rich('guideRealtimeRich', {
                strong: (c) => <strong className="text-zinc-300">{c}</strong>,
              })}
            </li>
            <li>
              {t.rich('guideSheetRich', {
                strong: (c) => <strong className="text-zinc-300">{c}</strong>,
              })}
            </li>
          </ul>
        </AdminGuidePanel>
      </div>

      {/* Header de crise — filtres priorité (score utilisé côté serveur uniquement pour le tri) */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setPriorityFilter('all')}
          className={`${badgeBase} ${
            priorityFilter === 'all'
              ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600'
          }`}
        >
          {t('filterAll')}
        </button>
        <button
          type="button"
          onClick={() => setPriorityFilter('100')}
          className={`${badgeBase} ${
            priorityFilter === '100'
              ? 'border-red-500/50 bg-red-950/40 text-red-200'
              : 'border-red-900/40 bg-red-950/15 text-red-400/90 hover:border-red-800/60'
          }`}
        >
          {t('filterCritical')}
        </button>
        <button
          type="button"
          onClick={() => setPriorityFilter('50')}
          className={`${badgeBase} ${
            priorityFilter === '50'
              ? 'border-amber-500/50 bg-amber-950/35 text-amber-100'
              : 'border-amber-900/35 bg-amber-950/15 text-amber-400/90 hover:border-amber-800/50'
          }`}
        >
          {t('filterWatch')}
        </button>
        <button
          type="button"
          onClick={() => setPriorityFilter('0')}
          className={`${badgeBase} ${
            priorityFilter === '0'
              ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-100'
              : 'border-zinc-800 bg-zinc-900/50 text-emerald-400/70 hover:border-zinc-600'
          }`}
        >
          {t('filterHealthy')}
        </button>
      </div>

      {isError && (
        <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error instanceof Error ? error.message : t('errGeneric')}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800/80 overflow-hidden">
        {debouncedSearch.trim() ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 bg-zinc-900/55 px-3 py-2 text-xs text-zinc-500">
            <span>{t('activeSearchBanner')}</span>
            <button
              type="button"
              className="font-medium text-sky-400/90 underline-offset-2 hover:text-sky-300 hover:underline"
              onClick={() => setSearchInput('')}
            >
              {t('clearSearch')}
            </button>
          </div>
        ) : null}

        <div
          className="admin-clients-hscroll overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth touch-pan-x [scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.45)_rgba(24,24,27,0.3)] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/50 [&::-webkit-scrollbar-track]:bg-zinc-900/40"
          aria-label={t('tableAria')}
        >
          <div className="relative w-full min-w-0">
            <div
              className="flex w-full items-center border-b border-zinc-800/80 bg-zinc-900/95 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              role="row"
              style={{ minWidth: TABLE_MIN_W }}
            >
              <div className="min-w-[11rem] flex-[1.25] basis-0 py-2.5 pl-4 pr-2 leading-snug">
                {t('colEstablishment')}
              </div>
              <div className="min-w-[12rem] flex-[2.35] basis-0 px-2 py-2.5 leading-snug">{t('colEmail')}</div>
              <div className="w-[7.25rem] shrink-0 px-2 py-2.5 leading-snug">{t('colPhone')}</div>
              <div className="flex w-14 shrink-0 items-center justify-center py-2.5 leading-snug">{t('colUsage')}</div>
              <div className="flex w-[5.5rem] shrink-0 items-center justify-center px-1 py-2.5 leading-snug">
                {t('colPlan')}
              </div>
              <div className="flex w-[8rem] shrink-0 items-center justify-center px-1 py-2.5 leading-snug">
                {t('colStatus')}
              </div>
              <div className="flex w-[6.5rem] shrink-0 items-center justify-center px-1 py-2.5 leading-snug">
                {t('colRegistered')}
              </div>
              <div className="flex w-[5rem] shrink-0 items-center justify-center px-1 py-2.5 leading-snug">{t('colRole')}</div>
              <div
                className="flex w-11 shrink-0 items-center justify-center py-2.5 leading-snug"
                title={t('colLangTitle')}
              >
                {t('colLang')}
              </div>
              <div className="admin-fiche-hdr sticky right-0 z-30 box-border flex w-[6.25rem] shrink-0 items-center justify-end bg-zinc-900/95 py-2.5 pl-2 pr-4 text-right leading-snug">
                {t('sheetCta')}
              </div>
            </div>

        <div
          ref={parentRef}
          className={`overflow-y-auto ${listMaxHeightClass} min-h-[200px] bg-zinc-950/40 overscroll-y-contain`}
        >
          {isLoading && !data && (
            <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('loading')}
            </div>
          )}

          {showEmptySearch && (
            <div className="text-center py-16 text-zinc-500 text-sm px-4">{t('emptySearch')}</div>
          )}

          {showEmptyGlobal && (
            <div className="text-center py-16 text-zinc-600 text-sm px-4">{t('emptyGlobal')}</div>
          )}

          {!isLoading && flatClients.length > 0 && (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualizer.getVirtualItems().map((vi) => {
                const client = flatClients[vi.index];
                if (!client) return null;
                const planKey = client.subscription_plan ?? DEFAULT_PLAN_KEY;
                const planLbl = planLabel(planKey);
                const planColor = PLAN_COLORS[planKey] ?? PLAN_COLORS.free;
                const statusKey = client.subscription_status ?? '';
                const statusLbl = statusLabelFn(statusKey);
                const statusColor = STATUS_COLORS[statusKey] ?? DEFAULT_STATUS_ROW_CLASS;
                const email = client.email?.trim() || t('dashEmpty');
                const phone = client.phone?.trim() || t('dashEmpty');
                const nameParts = splitGivenFamily(client.full_name);
                const createdAt = client.created_at
                  ? format.dateTime(new Date(client.created_at), CLIENT_TABLE_DATE_FMT)
                  : t('dashEmpty');
                const pri = client.priority_score ?? 0;
                const series = Array.isArray(client.usage_series) ? client.usage_series : [0, 0, 0, 0, 0, 0, 0];
                const zebraRow = ZEBRA_ROW_CLASS[vi.index % 2];
                return (
                  <div
                    key={client.id}
                    role="row"
                    className={`group/row absolute left-0 top-0 flex w-full cursor-pointer items-center border-b border-zinc-800/35 text-[13px] leading-snug transition-colors hover:bg-zinc-800/35 hover:[&_.admin-fiche-cell]:!bg-zinc-800/35 ${zebraRow}`}
                    style={{
                      transform: `translateY(${vi.start}px)`,
                      height: `${vi.size}px`,
                      minWidth: TABLE_MIN_W,
                    }}
                    onClick={() => {
                      setDetailClientId(client.id);
                      setDetailEstablishmentLabel(
                        [client.establishment_name, client.full_name].filter(Boolean).join(' · ') ||
                          client.email ||
                          null
                      );
                    }}
                  >
                    <div className="pointer-events-none flex min-w-[11rem] flex-[1.25] basis-0 items-center gap-1.5 py-2 pl-4 pr-2">
                      {pri === 100 ? <CrisisPulseDot title={t('crisisPulseTitle')} /> : <span className="w-2 shrink-0" aria-hidden />}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-zinc-100">
                          {client.establishment_name || t('dashEmpty')}
                        </p>
                        <div className="mt-1 space-y-0.5">
                          <p className="break-words text-[11px] leading-snug text-zinc-500">
                            <span className="text-zinc-600">{t('givenLabel')}</span>{' '}
                            <span className="font-medium text-zinc-400">{nameParts?.given ?? t('dashEmpty')}</span>
                          </p>
                          <p className="break-words text-[11px] leading-snug text-zinc-500">
                            <span className="text-zinc-600">{t('familyLabel')}</span>{' '}
                            <span className="font-medium text-zinc-400">{nameParts?.family ?? t('dashEmpty')}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="pointer-events-none flex min-w-[12rem] flex-[2.35] basis-0 items-center px-2 py-2">
                      <span
                        className="line-clamp-2 min-w-0 break-all font-mono text-xs leading-snug text-zinc-300"
                        title={email}
                      >
                        {email}
                      </span>
                    </div>
                    <div className="pointer-events-none flex w-[7.25rem] shrink-0 items-center px-2 py-2">
                      <span
                        className="line-clamp-2 break-all font-mono text-xs leading-snug text-zinc-300"
                        title={phone}
                      >
                        {phone}
                      </span>
                    </div>
                    <div className="pointer-events-none flex w-14 shrink-0 items-center justify-center py-2">
                      <AdminClientUsageSparkline series={series} compact />
                    </div>
                    <div className="pointer-events-none flex w-[5.5rem] shrink-0 items-center justify-center px-1 py-2">
                      <span
                        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-1.5 py-1 text-[11px] font-semibold ${planColor}`}
                      >
                        {planLbl}
                      </span>
                    </div>
                    <div className="pointer-events-none flex w-[8rem] shrink-0 items-center justify-center px-1 py-2">
                      {statusKey ? (
                        <span
                          className={`inline-flex max-w-full shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${statusColor}`}
                        >
                          {statusKey === 'active' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : statusKey === 'trialing' ? (
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="leading-tight">{statusLbl}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </div>
                    <div className="pointer-events-none flex w-[6.5rem] shrink-0 items-center justify-center whitespace-nowrap px-1 py-2 font-mono text-xs text-zinc-400">
                      {createdAt}
                    </div>
                    <div className="pointer-events-none flex w-[5rem] shrink-0 items-center justify-center px-1 py-2">
                      {client.role === 'admin' ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md border border-blue-700/50 bg-blue-900/25 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-blue-300">
                          <Shield className="h-3 w-3 shrink-0" />
                          {t('roleAdmin')}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">{t('roleUser')}</span>
                      )}
                    </div>
                    <div className="pointer-events-none flex w-11 shrink-0 items-center justify-center py-2">
                      <span
                        className="inline-flex min-w-[1.75rem] justify-center rounded-md border border-zinc-700/60 bg-zinc-900/70 px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-zinc-300"
                        title={client.locale ? t('localeTitle', { locale: client.locale }) : t('localeUnsetTitle')}
                      >
                        {formatLocaleCell(client.locale)}
                      </span>
                    </div>
                    <div
                      className={`admin-fiche-cell sticky right-0 z-20 box-border flex w-[6.25rem] shrink-0 items-center justify-end py-2 pl-2 pr-4 ${zebraRow}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDetailClientId(client.id);
                          setDetailEstablishmentLabel(
                            [client.establishment_name, client.full_name].filter(Boolean).join(' · ') ||
                              client.email ||
                              null
                          );
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-950/30 px-2 py-1 text-xs font-semibold text-sky-200/95 transition-colors hover:border-sky-400/55 hover:bg-sky-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                        aria-label={t('openSheetAria', {
                          label: client.establishment_name || client.email || client.id,
                        })}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t('sheetCta')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {(isLoading || isFetchingNextPage) && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
            {summaryLine && <span>{summaryLine}</span>}
            {hasNextPage && !isFetchingNextPage && flatClients.length > 0 && (
              <span className="text-zinc-600">{t('loadMoreHint')}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
