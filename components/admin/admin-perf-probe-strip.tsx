'use client';

import { useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Gauge, Loader2, Play } from 'lucide-react';
import type { PerfProbePayload } from '@/lib/admin/perf-probe';

const PROBE_BUDGET_MS = 500;

export function AdminPerfProbeStrip() {
  const t = useTranslations('Admin.perfProbeStrip');
  const locale = useLocale();
  const [data, setData] = useState<PerfProbePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/perf-probe?budget=${PROBE_BUDGET_MS}`, { cache: 'no-store' });
      const j = (await res.json()) as PerfProbePayload & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errorGeneric'));
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [t]);

  return (
    <div className="mb-6 rounded-2xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/40">
            <Gauge className="h-5 w-5 text-zinc-400" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-200">
              {t('title', { budgetMs: PROBE_BUDGET_MS })}
            </h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{t('intro')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-zinc-700/70 bg-zinc-900/40 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {t('runButton')}
        </button>
      </div>

      {err ? <p className="mt-3 text-xs text-red-400/90">{err}</p> : null}

      {data ? (
        <div className="mt-4 space-y-3 border-t border-zinc-800/50 pt-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className={
                data.all_ok
                  ? 'rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300'
                  : 'rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-200'
              }
            >
              {data.all_ok ? t('statusOk') : t('statusWarn')}
            </span>
            <span className="font-mono text-zinc-600">
              {t('budgetLine', {
                budgetMs: data.budget_ms,
                burstCount: data.burst.count,
                burstMaxMs: data.burst.max_ms,
              })}
              {!data.burst.ok ? t('burstWarning') : ''}
            </span>
            <span className="text-zinc-600">
              {new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(new Date(data.checked_at))}
            </span>
          </div>
          <ul className="space-y-1.5 text-[11px] font-mono">
            {data.probes.map((p) => (
              <li
                key={p.id}
                className={`flex flex-wrap items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 ${
                  p.optional ? 'bg-zinc-900/30 text-zinc-500' : 'bg-zinc-950/40 text-zinc-400'
                }`}
              >
                <span className="min-w-0 flex-1 text-zinc-400">
                  {p.label}
                  {p.optional ? <span className="text-zinc-600">{t('optionalSuffix')}</span> : null}
                  {p.error ? <span className="block text-amber-400/90">{p.error}</span> : null}
                </span>
                <span className={p.ok && !p.error ? 'text-emerald-400/90' : 'text-amber-300'}>
                  {t('probeTiming', {
                    ms: p.ms,
                    failSuffix: p.ok ? '' : t('msFailSuffix'),
                  })}
                </span>
              </li>
            ))}
          </ul>
          <ul className="list-disc space-y-1 pl-4 text-[10px] leading-relaxed text-zinc-600">
            {data.advice.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
