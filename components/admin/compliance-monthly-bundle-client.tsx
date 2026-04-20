'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, FolderArchive, Loader2, RefreshCw } from 'lucide-react';

export type ComplianceBundleArchiveRow = {
  id: string;
  created_at: string;
  source: string;
  period_year: number;
  period_month: number;
  file_name: string;
  byte_size: number;
  signed_by: string | null;
  summary?: Record<string, unknown>;
};

type Props = {
  title: string;
  intro: string;
  monthLabel: string;
  signedByLabel: string;
  signedByPlaceholder: string;
  downloadLabel: string;
  hint: string;
  archivesTitle: string;
  archivesEmpty: string;
  archivesLoadError: string;
  sourceCron: string;
  sourceManual: string;
  archiveNowLabel: string;
  archiveNowBusy: string;
  refreshLabel: string;
  cronAutoHint: string;
  archiveDone: string;
};

function defaultMonthValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtArchiveDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ComplianceMonthlyBundleClient(props: Props) {
  const {
    title,
    intro,
    monthLabel,
    signedByLabel,
    signedByPlaceholder,
    downloadLabel,
    hint,
    archivesTitle,
    archivesEmpty,
    archivesLoadError,
    sourceCron,
    sourceManual,
    archiveNowLabel,
    archiveNowBusy,
    refreshLabel,
    cronAutoHint,
    archiveDone,
  } = props;

  const [month, setMonth] = useState(defaultMonthValue);
  const [signedBy, setSignedBy] = useState('');
  const [archives, setArchives] = useState<ComplianceBundleArchiveRow[]>([]);
  const [listStatus, setListStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveMsg, setArchiveMsg] = useState<string | null>(null);

  const href = useMemo(() => {
    const q = new URLSearchParams();
    q.set('month', month);
    const s = signedBy.trim();
    if (s) q.set('signed_by', s);
    return `/api/admin/compliance-bundle-pdf?${q.toString()}`;
  }, [month, signedBy]);

  const loadArchives = useCallback(async () => {
    setListStatus('loading');
    try {
      const res = await fetch('/api/admin/compliance-bundle-archive', { cache: 'no-store' });
      const json = (await res.json()) as { archives?: ComplianceBundleArchiveRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setArchives(json.archives ?? []);
      setListStatus('idle');
    } catch (e) {
      console.error(e);
      setListStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadArchives();
  }, [loadArchives]);

  const archiveOnServer = async () => {
    setArchiveBusy(true);
    setArchiveMsg(null);
    try {
      const res = await fetch('/api/admin/compliance-bundle-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, signed_by: signedBy.trim() || undefined }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; archive?: { id: string } };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (json.ok) {
        setArchiveMsg('__done__');
        await loadArchives();
      }
    } catch (e) {
      setArchiveMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <div
      id="dossier-mensuel-pdf"
      className="scroll-mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/[0.07] px-4 py-4 sm:px-5 space-y-4"
    >
      <h2 className="text-xs font-semibold text-blue-200/90 uppercase tracking-widest">{title}</h2>
      <p className="text-xs text-zinc-400 leading-relaxed">{intro}</p>
      <p className="text-[10px] text-zinc-500 leading-relaxed border-l-2 border-blue-500/40 pl-2">{cronAutoHint}</p>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <label className="flex flex-col gap-1 min-w-[11rem]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{monthLabel}</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/35"
          />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{signedByLabel}</span>
          <input
            type="text"
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder={signedByPlaceholder}
            maxLength={160}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/35"
          />
        </label>
        <a
          href={href}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/40 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-900/45 hover:border-blue-400/55 transition-colors shrink-0"
        >
          <FileDown className="w-4 h-4 shrink-0" aria-hidden />
          {downloadLabel}
        </a>
        <button
          type="button"
          disabled={archiveBusy}
          onClick={() => void archiveOnServer()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/35 disabled:opacity-50 shrink-0"
        >
          {archiveBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FolderArchive className="w-4 h-4" />}
          {archiveBusy ? archiveNowBusy : archiveNowLabel}
        </button>
      </div>

      {archiveMsg ? (
        <p
          className={`text-xs ${archiveMsg === '__done__' ? 'text-emerald-400/90' : 'text-red-300'}`}
          role="status"
        >
          {archiveMsg === '__done__' ? archiveDone : archiveMsg}
        </p>
      ) : null}

      <p className="text-[10px] text-zinc-500 leading-relaxed">{hint}</p>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{archivesTitle}</h3>
          <button
            type="button"
            onClick={() => void loadArchives()}
            disabled={listStatus === 'loading'}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${listStatus === 'loading' ? 'animate-spin' : ''}`} />
            {refreshLabel}
          </button>
        </div>
        {listStatus === 'error' ? (
          <p className="px-3 py-6 text-xs text-red-300 text-center">{archivesLoadError}</p>
        ) : archives.length === 0 ? (
          <p className="px-3 py-8 text-xs text-zinc-600 text-center">{archivesEmpty}</p>
        ) : (
          <ul className="divide-y divide-zinc-800/70 max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain">
            {archives.map((a) => (
              <li key={a.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-zinc-200 block truncate">
                    {a.period_year}-{String(a.period_month).padStart(2, '0')} · {a.file_name}
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    {fmtArchiveDate(a.created_at)} · {fmtBytes(a.byte_size)} ·{' '}
                    <span className={a.source === 'cron' ? 'text-sky-400/90' : 'text-amber-400/90'}>
                      {a.source === 'cron' ? sourceCron : sourceManual}
                    </span>
                    {a.signed_by ? ` · ${a.signed_by}` : null}
                  </span>
                </div>
                <a
                  href={`/api/admin/compliance-bundle-archive/${a.id}/download`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
