'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { FileUp, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  type CrmImportColumnMapping,
  buildCommitRowsFromGrid,
  mergeMapping,
  MAX_IMPORT_ROWS,
  resolveCrmImportRowNames,
} from '@/lib/banano/crm-import';
import { detectHeaderAndData, parseSpreadsheetBuffer } from '@/lib/banano/crm-import-parse';
import { sanitizeImportPhoneColumn } from '@/lib/banano/phone';

type Step = 'pick' | 'review' | 'done';

type CommitResult = {
  processed: number;
  inserted: number;
  updated: number;
  skippedInvalidPhone: number;
  errors: number;
};

type Props = {
  loyaltyMode: 'points' | 'stamps';
  onImported: () => void;
};

export function BananoCrmImportWizard({ loyaltyMode, onImported }: Props) {
  const locale = useLocale();
  const t = useTranslations('Dashboard.bananoCrmImport');

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('pick');
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyCommit, setBusyCommit] = useState(false);
  const [drag, setDrag] = useState(false);

  const [narrative, setNarrative] = useState('');
  const [mapping, setMapping] = useState<CrmImportColumnMapping | null>(null);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [source, setSource] = useState<string>('heuristic');
  const [commitSummary, setCommitSummary] = useState<CommitResult | null>(null);
  const [statsExtra, setStatsExtra] = useState({ dup: 0, skipInv: 0, unique: 0 });

  const rowPreviewLabel = useCallback(
    (row: string[], m: CrmImportColumnMapping): string => {
      const fi = m.firstNameIndex != null ? String(row[m.firstNameIndex] ?? '').trim() : '';
      const la = m.lastNameIndex != null ? String(row[m.lastNameIndex] ?? '').trim() : '';
      const full = m.fullNameIndex != null ? String(row[m.fullNameIndex] ?? '').trim() : '';
      if (!fi && !la && !full) return t('em_dash');
      return resolveCrmImportRowNames(row, m).display_name;
    },
    [t]
  );

  const applyMappingPatch = useCallback((patch: Partial<CrmImportColumnMapping>) => {
    setMapping((prev) => (prev ? mergeMapping(prev, patch) : prev));
  }, []);

  useEffect(() => {
    if (step !== 'review' || !mapping || !dataRows.length) return;
    const built = buildCommitRowsFromGrid(dataRows, mapping, loyaltyMode);
    setStatsExtra({
      dup: built.duplicateMerged,
      skipInv: built.skippedInvalidPhone,
      unique: built.rows.length,
    });
  }, [step, mapping, dataRows, loyaltyMode]);

  const reset = useCallback(() => {
    setStep('pick');
    setNarrative('');
    setMapping(null);
    setDataRows([]);
    setHeaders([]);
    setSource('heuristic');
    setCommitSummary(null);
    setStatsExtra({ dup: 0, skipInv: 0, unique: 0 });
    setBusyPreview(false);
    setBusyCommit(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const runPreview = useCallback(
    async (file: File) => {
      setBusyPreview(true);
      setCommitSummary(null);
      try {
        const buf = await file.arrayBuffer();
        const grid = parseSpreadsheetBuffer(buf, XLSX);
        const { headers: h, dataRows: dr } = detectHeaderAndData(grid);
        if (!h.length || !dr.length) {
          toast.error(t('toast_empty_file'));
          return;
        }

        let rows = dr;
        let truncated = false;
        if (rows.length > MAX_IMPORT_ROWS) {
          rows = rows.slice(0, MAX_IMPORT_ROWS);
          truncated = true;
        }

        const sampleRows = rows.slice(0, 18).map((r) => r.map((c) => String(c ?? '')));

        const res = await fetch('/api/banano/crm/import/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            headers: h,
            sampleRows,
            totalRows: rows.length,
          }),
        });
        const data = (await res.json()) as {
          mapping?: CrmImportColumnMapping;
          narrative?: string;
          source?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? t('err_analyse_impossible'));

        if (!data.mapping) throw new Error(t('err_invalid_response'));

        const built = buildCommitRowsFromGrid(rows, data.mapping, loyaltyMode);

        setHeaders(h);
        setDataRows(rows);
        setMapping(data.mapping);
        setNarrative(data.narrative ?? '');
        setSource(data.source ?? 'heuristic');
        setStatsExtra({
          dup: built.duplicateMerged,
          skipInv: built.skippedInvalidPhone,
          unique: built.rows.length,
        });
        setStep('review');
        if (truncated) {
          toast.message(t('toast_truncated', { max: MAX_IMPORT_ROWS.toLocaleString(locale) }));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('err_generic'));
      } finally {
        setBusyPreview(false);
      }
    },
    [loyaltyMode, locale, t]
  );

  const onPickFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      void runPreview(f);
    },
    [runPreview]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) void runPreview(f);
    },
    [runPreview]
  );

  const commit = useCallback(async () => {
    if (!mapping) return;
    setBusyCommit(true);
    try {
      const built = buildCommitRowsFromGrid(dataRows, mapping, loyaltyMode);
      const res = await fetch('/api/banano/crm/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: built.rows }),
      });
      const data = (await res.json()) as CommitResult & { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? t('err_merge_impossible'));
      setCommitSummary({
        processed: data.processed,
        inserted: data.inserted,
        updated: data.updated,
        skippedInvalidPhone: data.skippedInvalidPhone,
        errors: data.errors,
      });
      setStep('done');
      const total = data.inserted + data.updated;
      toast.success(total === 1 ? t('toast_success_one') : t('toast_success_many', { count: total }));
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('err_generic'));
    } finally {
      setBusyCommit(false);
    }
  }, [mapping, dataRows, loyaltyMode, t, onImported]);

  const dupPart =
    statsExtra.dup > 0 ? t('stats_dup_suffix', { dup: statsExtra.dup.toLocaleString(locale) }) : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-[#2563eb] text-white shadow-md shadow-indigo-500/20 hover:opacity-95 dark:from-indigo-500 dark:to-sky-600"
      >
        <Upload className="w-4 h-4 shrink-0" />
        {t('cta_import')}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                aria-label={t('aria_close')}
                onClick={close}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="crm-import-title"
                className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#09090b] shadow-2xl flex flex-col max-h-[min(92vh,720px)]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 flex items-start gap-3 p-4 border-b border-slate-200 dark:border-zinc-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 id="crm-import-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      {t('title')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('subtitle')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="shrink-0 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
                    aria-label={t('aria_close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                  {step === 'pick' ? (
                    <>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDrag(true);
                        }}
                        onDragLeave={() => setDrag(false)}
                        onDrop={onDrop}
                        className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
                          drag
                            ? 'border-[#2563eb] bg-[#2563eb]/5'
                            : 'border-slate-300 dark:border-zinc-600 bg-slate-50/80 dark:bg-zinc-900/40'
                        }`}
                      >
                        <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                          {t('drop_title')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t('drop_hint')}</p>
                        <label className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold cursor-pointer hover:opacity-90">
                          {busyPreview ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {t('choose_file')}
                          <input
                            type="file"
                            className="sr-only"
                            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            disabled={busyPreview}
                            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                          />
                        </label>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t('pick_help', {
                          balanceWord:
                            loyaltyMode === 'points' ? t('word_points') : t('word_stamps'),
                          programMode:
                            loyaltyMode === 'points' ? t('mode_points_only') : t('mode_stamps_only'),
                        })}
                      </p>
                    </>
                  ) : null}

                  {step === 'review' && mapping ? (
                    <>
                      <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/50 bg-indigo-50/80 dark:bg-indigo-950/35 p-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          {t('analysis_prefix')}
                          {source === 'hybrid'
                            ? t('analysis_hybrid')
                            : source === 'ai'
                              ? t('analysis_ai')
                              : t('analysis_auto')}
                        </p>
                        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">{narrative}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                          {t('stats_line', {
                            rows: dataRows.length.toLocaleString(locale),
                            unique: statsExtra.unique.toLocaleString(locale),
                            dupPart,
                          })}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-4 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                            {t('mapping_title')}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{t('mapping_help')}</p>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-700">
                          <table className="w-full text-[11px] text-left min-w-[360px]">
                            <thead className="bg-white dark:bg-zinc-900/90 text-slate-600 dark:text-slate-400">
                              <tr>
                                <th className="px-2 py-1.5 font-semibold w-10">{t('col_hash')}</th>
                                {headers.map((h, i) => (
                                  <th
                                    key={i}
                                    className="px-2 py-1.5 font-semibold whitespace-nowrap max-w-[140px] truncate"
                                    title={h}
                                  >
                                    {h || t('col_fallback', { n: i + 1 })}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-[#09090b]">
                              {dataRows.slice(0, 3).map((row, ri) => (
                                <tr key={ri}>
                                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{ri + 1}</td>
                                  {headers.map((_, ci) => (
                                    <td
                                      key={ci}
                                      className="px-2 py-1.5 text-slate-800 dark:text-slate-200 max-w-[140px] truncate"
                                      title={String(row[ci] ?? '')}
                                    >
                                      {row[ci] != null && String(row[ci]) !== ''
                                        ? String(row[ci])
                                        : t('em_dash')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('label_phone')}
                            <select
                              className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                              value={mapping.phoneIndex}
                              onChange={(e) => applyMappingPatch({ phoneIndex: Number(e.target.value) })}
                            >
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || t('column_label', { n: i + 1 })}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('label_firstName')}
                            <select
                              className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                              value={mapping.firstNameIndex ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                applyMappingPatch({ firstNameIndex: v === '' ? null : Number(v) });
                              }}
                            >
                              <option value="">{t('column_none')}</option>
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || t('column_label', { n: i + 1 })}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('label_lastName')}
                            <select
                              className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                              value={mapping.lastNameIndex ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                applyMappingPatch({ lastNameIndex: v === '' ? null : Number(v) });
                              }}
                            >
                              <option value="">{t('column_none')}</option>
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || t('column_label', { n: i + 1 })}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {t('label_fullName')}
                            <select
                              className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                              value={mapping.fullNameIndex ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                applyMappingPatch({ fullNameIndex: v === '' ? null : Number(v) });
                              }}
                            >
                              <option value="">{t('column_none')}</option>
                              {headers.map((h, i) => (
                                <option key={i} value={i}>
                                  {h || t('column_label', { n: i + 1 })}
                                </option>
                              ))}
                            </select>
                          </label>
                          {loyaltyMode === 'points' ? (
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {t('label_points_balance')}
                              <select
                                className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                                value={mapping.pointsBalanceIndex ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  applyMappingPatch({ pointsBalanceIndex: v === '' ? null : Number(v) });
                                }}
                              >
                                <option value="">{t('column_none')}</option>
                                {headers.map((h, i) => (
                                  <option key={i} value={i}>
                                    {h || t('column_label', { n: i + 1 })}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {t('label_stamps_balance')}
                              <select
                                className="mt-1 w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-sm"
                                value={mapping.stampsBalanceIndex ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  applyMappingPatch({ stampsBalanceIndex: v === '' ? null : Number(v) });
                                }}
                              >
                                <option value="">{t('column_none')}</option>
                                {headers.map((h, i) => (
                                  <option key={i} value={i}>
                                    {h || t('column_label', { n: i + 1 })}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[480px]">
                          <thead className="bg-slate-50 dark:bg-zinc-900/80 text-slate-500 dark:text-slate-400">
                            <tr>
                              <th className="px-3 py-2 font-semibold">{t('preview_th_phone')}</th>
                              <th className="px-3 py-2 font-semibold">{t('preview_th_name')}</th>
                              <th className="px-3 py-2 font-semibold">{t('preview_th_points')}</th>
                              <th className="px-3 py-2 font-semibold">{t('preview_th_stamps')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {dataRows.slice(0, 5).map((row, idx) => {
                              const rawPhone = String(row[mapping.phoneIndex] ?? '');
                              const normalized = sanitizeImportPhoneColumn(rawPhone);
                              return (
                                <tr key={idx}>
                                  <td
                                    className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200"
                                    title={rawPhone || undefined}
                                  >
                                    {normalized ?? t('em_dash')}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                                    {rowPreviewLabel(row, mapping)}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {mapping.pointsBalanceIndex != null
                                      ? row[mapping.pointsBalanceIndex] ?? t('em_dash')
                                      : t('em_dash')}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {mapping.stampsBalanceIndex != null
                                      ? row[mapping.stampsBalanceIndex] ?? t('em_dash')
                                      : t('em_dash')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <p className="px-3 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-zinc-800">
                          {t('preview_footer', {
                            detected: (() => {
                              const parts: string[] = [];
                              if (headers[mapping.phoneIndex]) {
                                parts.push(
                                  t('preview_detected_phone', { name: headers[mapping.phoneIndex] })
                                );
                              }
                              if (
                                loyaltyMode === 'points' &&
                                mapping.pointsBalanceIndex != null &&
                                headers[mapping.pointsBalanceIndex]
                              ) {
                                parts.push(
                                  t('preview_detected_points', {
                                    name: headers[mapping.pointsBalanceIndex],
                                  })
                                );
                              }
                              if (
                                loyaltyMode === 'stamps' &&
                                mapping.stampsBalanceIndex != null &&
                                headers[mapping.stampsBalanceIndex]
                              ) {
                                parts.push(
                                  t('preview_detected_stamps', {
                                    name: headers[mapping.stampsBalanceIndex],
                                  })
                                );
                              }
                              return parts.join('');
                            })(),
                          })}
                        </p>
                      </div>
                    </>
                  ) : null}

                  {step === 'done' && commitSummary ? (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 text-sm text-emerald-950 dark:text-emerald-100 space-y-2">
                      <p className="font-semibold text-base">
                        {commitSummary.inserted + commitSummary.updated === 1
                          ? t('done_title_one')
                          : t('done_title_many', {
                              count: commitSummary.inserted + commitSummary.updated,
                            })}
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-emerald-900/90 dark:text-emerald-200/95 text-[13px]">
                        <li>
                          {t('done_li_detail', {
                            inserted: commitSummary.inserted,
                            updated: commitSummary.updated,
                          })}
                        </li>
                        <li>{t('done_li_processed', { n: commitSummary.processed })}</li>
                        {commitSummary.skippedInvalidPhone > 0 ? (
                          <li>{t('done_li_skipped', { n: commitSummary.skippedInvalidPhone })}</li>
                        ) : null}
                        {commitSummary.errors > 0 ? (
                          <li className="text-amber-800 dark:text-amber-200">
                            {t('done_li_errors', { n: commitSummary.errors })}
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-2 p-4 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {step === 'done' ? t('btn_close') : t('btn_cancel')}
                  </button>
                  {step === 'review' ? (
                    <button
                      type="button"
                      disabled={busyCommit || !mapping}
                      onClick={() => void commit()}
                      className="flex-1 min-h-[44px] rounded-xl bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {busyCommit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {t('btn_merge')}
                    </button>
                  ) : null}
                  {step === 'done' ? (
                    <button
                      type="button"
                      onClick={() => reset()}
                      className="flex-1 min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold"
                    >
                      {t('btn_another_file')}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
