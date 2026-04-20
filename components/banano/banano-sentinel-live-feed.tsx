'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Gift,
  Keyboard,
  Radar,
  Receipt,
  ScanLine,
  Smartphone,
  Sparkles,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { siteLocaleToDateFnsLocale } from '@/lib/banano/pilotage/date-locale';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

const SENTINEL_FEED_TIME_FORMAT = 'dd/MM/yyyy HH:mm';

type GhostAuditRow = {
  id: string;
  user_id: string;
  member_id: string | null;
  source: string;
  action: string;
  payload: Record<string, unknown>;
  ticket_total_cents: number | null;
  ticket_fingerprint: string | null;
  created_at: string;
};

function memberLabelFromRow(
  m: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  },
  dash: string
): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : dash;
}

export function BananoSentinelLiveFeed() {
  const t = useTranslations('Dashboard.bananoSentinel');
  const locale = useLocale();
  const intlTag = siteLocaleToIntlDateTag(locale);
  const dateFnsLocale = useMemo(() => siteLocaleToDateFnsLocale(locale), [locale]);

  const formatEuros = useCallback(
    (cents: number | null | undefined): string | null => {
      if (cents == null || !Number.isFinite(cents)) return null;
      const n = Math.floor(cents);
      return (n / 100).toLocaleString(intlTag, {
        minimumFractionDigits: n % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
    },
    [intlTag]
  );

  const actionMeta = useCallback(
    (action: string): {
      title: string;
      Icon: typeof Users;
      accent: string;
    } => {
      switch (action) {
        case 'scan_resolve':
          return { title: t('action_scan_resolve'), Icon: ScanLine, accent: 'text-sky-400' };
        case 'transact_earn':
          return { title: t('action_transact_earn'), Icon: Sparkles, accent: 'text-emerald-400' };
        case 'transact_redeem_points':
          return { title: t('action_transact_redeem_points'), Icon: Users, accent: 'text-amber-400' };
        case 'transact_staff_usage':
          return { title: t('action_transact_staff_usage'), Icon: UtensilsCrossed, accent: 'text-violet-400' };
        case 'voucher_redeem':
          return { title: t('action_voucher_redeem'), Icon: Gift, accent: 'text-amber-300' };
        case 'enroll':
          return { title: t('action_enroll'), Icon: UserPlus, accent: 'text-cyan-400' };
        case 'device_bind':
          return { title: t('action_device_bind'), Icon: Smartphone, accent: 'text-slate-400' };
        case 'ticket_sniffer':
          return { title: t('action_ticket_sniffer'), Icon: Receipt, accent: 'text-slate-300' };
        case 'macro_play':
          return { title: t('action_macro_play'), Icon: Keyboard, accent: 'text-slate-300' };
        default:
          return { title: action || t('action_default'), Icon: Radar, accent: 'text-slate-400' };
      }
    },
    [t]
  );

  const impactLine = useCallback(
    (row: GhostAuditRow): string => {
      const p = row.payload ?? {};
      const ticketEuro = formatEuros(row.ticket_total_cents);

      switch (row.action) {
        case 'transact_earn':
          return ticketEuro
            ? t('impact_earn_ticket', { amount: ticketEuro })
            : t('impact_earn_no_ticket');
        case 'transact_staff_usage': {
          const debit = formatEuros(row.ticket_total_cents);
          const rem = formatEuros(
            typeof p.remainingEuroCentsAfter === 'number' ? p.remainingEuroCentsAfter : null
          );
          if (debit && rem != null) return t('impact_staff_both', { debit, rem });
          if (debit) return t('impact_staff_debit', { debit });
          return t('impact_staff_plain');
        }
        case 'voucher_redeem': {
          const code = typeof p.code === 'string' ? p.code : '';
          return code ? t('impact_voucher_code', { code }) : t('impact_voucher_plain');
        }
        case 'scan_resolve': {
          const resolved = typeof p.resolved === 'string' ? p.resolved : '';
          if (resolved === 'member_card') {
            const found =
              p.found === true
                ? t('scan_found_recognized')
                : p.found === false
                  ? t('scan_found_unknown')
                  : '';
            return found ? t('scan_member_with_status', { status: found }) : t('scan_member');
          }
          if (resolved === 'voucher') return t('scan_voucher');
          if (resolved === 'unknown') return t('scan_unknown');
          return resolved ? t('scan_resolution', { resolved }) : t('scan_default');
        }
        default:
          if (ticketEuro) return t('impact_ticket', { amount: ticketEuro });
          return '';
      }
    },
    [formatEuros, t]
  );

  const [rows, setRows] = useState<GhostAuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const pulseIds = useRef<Set<string>>(new Set());
  const [, bump] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  const hydrateNames = useCallback(
    async (memberIds: (string | null)[]) => {
      const ids = [...new Set(memberIds.filter((x): x is string => typeof x === 'string' && x.length > 0))];
      if (ids.length === 0) return;

      const { data, error: qErr } = await supabase
        .from('banano_loyalty_members')
        .select('id, display_name, first_name, last_name')
        .in('id', ids);

      if (qErr) {
        console.warn('[sentinel-live] members', qErr.message);
        return;
      }

      setNames((prev) => {
        const next = { ...prev };
        for (const m of data ?? []) {
          const r = m as {
            id: string;
            display_name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
          };
          if (!next[r.id]) next[r.id] = memberLabelFromRow(r, t('dash'));
        }
        return next;
      });
    },
    [supabase, t]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        if (!cancelled) {
          setError(t('sessionRequired'));
          setLoading(false);
        }
        return;
      }

      const { data, error: qErr } = await supabase
        .from('banano_ghost_audit_events')
        .select(
          'id, user_id, member_id, source, action, payload, ticket_total_cents, ticket_fingerprint, created_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }

      const list = (data ?? []) as GhostAuditRow[];
      setRows(list);
      void hydrateNames(list.map((r) => r.member_id));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, hydrateNames, t]);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;

      ch = supabase
        .channel(`ghost-audit:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'banano_ghost_audit_events',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as GhostAuditRow;
            if (!row?.id) return;
            pulseIds.current.add(row.id);
            bump((n) => n + 1);
            setRows((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev].slice(0, 120);
            });
            void hydrateNames([row.member_id]);
            setTimeout(() => {
              pulseIds.current.delete(row.id);
              bump((n) => n + 1);
            }, 1400);
          }
        )
        .subscribe((status) => {
          setConnected(status === 'SUBSCRIBED');
        });
    })();

    return () => {
      if (ch) void supabase.removeChannel(ch);
    };
  }, [supabase, hydrateNames]);

  return (
    <div
      className="rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[0_0_0_1px_rgba(251,191,36,0.06)] overflow-hidden"
      style={{ fontFamily: 'var(--font-whatsapp-review-inter), ui-sans-serif, system-ui, sans-serif' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-zinc-800/90 bg-zinc-950">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-amber-500/15 p-2 ring-1 ring-amber-500/35">
            <Radar className="w-5 h-5 text-amber-400" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-50">{t('title')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              connected
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                : 'border-zinc-700 text-zinc-500 bg-zinc-900'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}
            />
            {connected ? t('live') : t('connecting')}
          </span>
        </div>
      </div>

      <div className="px-4 sm:px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <p className="text-xs font-semibold text-amber-200/90">{t('explainerTitle')}</p>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{t('explainerBody')}</p>
      </div>

      {error ? (
        <div className="px-4 py-6 text-sm text-red-400">{error}</div>
      ) : loading ? (
        <div className="px-4 py-12 flex justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500/25 border-t-amber-400 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-zinc-500">{t('empty')}</div>
      ) : (
        <ul className="max-h-[min(70vh,560px)] overflow-y-auto divide-y divide-zinc-800/80">
          {rows.map((row) => {
            const meta = actionMeta(row.action);
            const Icon = meta.Icon;
            const name = row.member_id ? (names[row.member_id] ?? t('memberPending')) : t('dash');
            const impact = impactLine(row);
            const isPulse = pulseIds.current.has(row.id);
            const timeLabel = (() => {
              try {
                return format(new Date(row.created_at), SENTINEL_FEED_TIME_FORMAT, { locale: dateFnsLocale });
              } catch {
                return row.created_at;
              }
            })();

            return (
              <li
                key={row.id}
                className={`px-4 sm:px-5 py-3.5 transition-[background,box-shadow] duration-500 ${
                  isPulse ? 'bg-amber-500/[0.07] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]' : 'bg-transparent'
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`shrink-0 rounded-xl p-2.5 bg-zinc-900 ring-1 ring-zinc-800 ${meta.accent}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <span className="text-sm font-semibold text-zinc-100 truncate">{name}</span>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/95 px-2 py-0.5 rounded-full bg-amber-500/10 ring-1 ring-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                        title={t('traceTitle')}
                      >
                        {t('verifiedByGhost')}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      <span className={meta.accent}>{meta.title}</span>
                      <span className="text-zinc-600 mx-1.5">·</span>
                      {timeLabel}
                    </p>
                    {impact ? <p className="text-sm text-zinc-300 leading-snug">{impact}</p> : null}
                    {row.source && row.source !== 'ghost_agent' ? (
                      <p className="text-[11px] text-zinc-600">{t('sourceLabel', { source: row.source })}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
