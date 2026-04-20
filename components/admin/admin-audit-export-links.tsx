'use client';

import { useMemo, useState } from 'react';
import { ZENITH_AUDIT_EXPORT_DEFAULT_DAYS } from '@/lib/zenith-capture/policy';
import { Database, Download, FileSpreadsheet, Search, X } from 'lucide-react';

export type AuditExportMerchant = { id: string; label: string; email?: string | null };

const MIN_LABEL_CHARS = 2;
/** Fragment UUID sans tirets : à partir de 8 caractères on filtre sur l'id. */
const MIN_UUID_FRAGMENT = 8;

type Labels = {
  merchantFilterLabel: string;
  merchantFilterAll: string;
  merchantFilterHint: string;
  merchantSearchPlaceholder: string;
  merchantSearchPrompt: string;
  merchantFilterEmpty: string;
  includeMessageBodiesLabel: string;
  includeMessageBodiesHint: string;
  auditJsonLabel: string;
  auditJsonCadence: string;
  auditJsonHint: string;
  auditCsvQueueLabel: string;
  auditCsvQueueCadence: string;
  auditCsvQueueHint: string;
  auditCsvConsentLabel: string;
  auditCsvConsentCadence: string;
  auditCsvConsentHint: string;
};

type Props = {
  merchants: AuditExportMerchant[];
  labels: Labels;
};

export function AdminAuditExportLinks({ merchants, labels }: Props) {
  const [merchantId, setMerchantId] = useState('');
  const [merchantSearch, setMerchantSearch] = useState('');
  const [includeBodies, setIncludeBodies] = useState(false);

  const merchantExtra = useMemo(
    () => (merchantId.trim() ? `&merchant_id=${encodeURIComponent(merchantId.trim())}` : ''),
    [merchantId]
  );

  const bodiesExtra = useMemo(
    () => (includeBodies ? '&include_message_bodies=true' : ''),
    [includeBodies]
  );

  const d = ZENITH_AUDIT_EXPORT_DEFAULT_DAYS;
  const jsonHref = `/api/admin/compliance-queue-export?format=json&days=${d}${merchantExtra}${bodiesExtra}`;
  const csvQueueHref = `/api/admin/compliance-queue-export?format=csv&dataset=queue&days=${d}${merchantExtra}${bodiesExtra}`;
  const csvConsentHref = `/api/admin/compliance-queue-export?format=csv&dataset=consent&days=${d}${merchantExtra}`;

  const selectedRow = useMemo(() => {
    const id = merchantId.trim();
    if (!id) return null;
    return merchants.find((m) => m.id === id) ?? null;
  }, [merchants, merchantId]);

  const { listRows, showResults, emptySearch } = useMemo(() => {
    const raw = merchantSearch.trim();
    const q = raw.toLowerCase().replace(/\s+/g, ' ');
    const compactQ = q.replace(/-/g, '');

    const searchActive =
      q.length >= MIN_LABEL_CHARS || compactQ.length >= MIN_UUID_FRAGMENT;

    if (!searchActive) {
      return {
        listRows: [] as AuditExportMerchant[],
        showResults: false,
        emptySearch: false,
      };
    }

    const filtered = merchants.filter((m) => {
      const lab = m.label.toLowerCase();
      const em = (m.email ?? '').toLowerCase();
      const compactId = m.id.replace(/-/g, '').toLowerCase();
      if (compactQ.length >= MIN_UUID_FRAGMENT && compactId.includes(compactQ)) return true;
      if (q.length >= MIN_LABEL_CHARS && lab.includes(q)) return true;
      if (q.length >= MIN_LABEL_CHARS && em.includes(q)) return true;
      return false;
    });

    if (filtered.length === 0) {
      return { listRows: [], showResults: true, emptySearch: true };
    }

    return { listRows: filtered, showResults: true, emptySearch: false };
  }, [merchants, merchantSearch]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/50 px-4 py-3 space-y-3">
        <label htmlFor="audit-merchant-filter" className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">
          {labels.merchantFilterLabel}
        </label>

        {merchantId ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-600/40 bg-emerald-950/30 px-3 py-2">
            <div className="text-sm text-zinc-100 flex-1 min-w-0 space-y-1">
              <p className="break-words whitespace-normal leading-snug font-medium">
                {selectedRow?.label ?? merchantId.trim()}
              </p>
              {selectedRow?.email ? (
                <p className="break-all text-xs text-zinc-400 leading-snug">{selectedRow.email}</p>
              ) : null}
              <p className="break-all font-mono text-[10px] text-zinc-500 leading-snug">{merchantId.trim()}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMerchantId('');
                setMerchantSearch('');
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/40 shrink-0"
            >
              <X className="w-3 h-3" />
              {labels.merchantFilterAll}
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                id="audit-merchant-filter"
                type="search"
                autoComplete="off"
                value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                placeholder={labels.merchantSearchPlaceholder}
                className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 text-sm text-zinc-200 placeholder:text-zinc-600 pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            {merchants.length > 0 ? (
              <div
                className={`rounded-lg border bg-zinc-950/80 overflow-hidden ${
                  showResults ? 'border-zinc-800' : 'border-zinc-800/60'
                }`}
              >
                {!showResults ? (
                  <p className="text-xs text-zinc-500 px-3 py-8 text-center leading-relaxed max-w-xl mx-auto">
                    {labels.merchantSearchPrompt}
                  </p>
                ) : emptySearch ? (
                  <p className="text-xs text-zinc-500 px-3 py-8 text-center">{labels.merchantFilterEmpty}</p>
                ) : (
                  <div className="max-h-[min(220px,45vh)] overflow-y-auto overscroll-contain">
                    <ul className="divide-y divide-zinc-800/80" role="listbox">
                      {listRows.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={merchantId === m.id}
                            onClick={() => {
                              setMerchantId(m.id);
                              setMerchantSearch('');
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/70 transition-colors"
                          >
                            <span className="block font-medium truncate">{m.label}</span>
                            <span className="block text-[10px] text-zinc-500 font-mono truncate mt-0.5">{m.id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </>
        )}

        <p className="text-[11px] text-zinc-500 leading-relaxed">{labels.merchantFilterHint}</p>

        <label className="flex items-start gap-3 cursor-pointer group rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 hover:border-zinc-700/80 transition-colors">
          <input
            type="checkbox"
            checked={includeBodies}
            onChange={(e) => setIncludeBodies(e.target.checked)}
            className="mt-0.5 rounded border-zinc-600 text-emerald-600 focus:ring-emerald-500/40"
          />
          <span>
            <span className="block text-sm text-zinc-200 group-hover:text-white">{labels.includeMessageBodiesLabel}</span>
            <span className="block text-[11px] text-zinc-500 mt-1 leading-relaxed">{labels.includeMessageBodiesHint}</span>
          </span>
        </label>
      </div>

      <ul className="rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
        <li>
          <a
            href={jsonHref}
            className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center flex-shrink-0">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                {labels.auditJsonLabel}
                <Download className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              </span>
              <p className="text-xs text-zinc-500 mt-0.5">{labels.auditJsonHint}</p>
            </div>
          </a>
        </li>
        <li>
          <a href={csvQueueHref} className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                {labels.auditCsvQueueLabel}
                <Download className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              </span>
              <p className="text-[11px] text-emerald-400/85 font-medium leading-snug mt-1.5">{labels.auditCsvQueueCadence}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{labels.auditCsvQueueHint}</p>
            </div>
          </a>
        </li>
        <li>
          <a href={csvConsentHref} className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                {labels.auditCsvConsentLabel}
                <Download className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              </span>
              <p className="text-[11px] text-emerald-400/85 font-medium leading-snug mt-1.5">{labels.auditCsvConsentCadence}</p>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{labels.auditCsvConsentHint}</p>
            </div>
          </a>
        </li>
      </ul>
    </div>
  );
}
