'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PilotageReportListItem } from '@/lib/banano/pilotage/types';
import type { VoucherMonthArchiveListItem } from '@/lib/banano/voucher-month-archive-types';

type Props = {
  open: boolean;
  onClose: () => void;
  locale: string;
  voucherMonthArchives: {
    loyalty: VoucherMonthArchiveListItem[];
    staff: VoucherMonthArchiveListItem[];
  };
  traceabilityMonthLinks: { ym: string; label: string }[];
  archiveExportYear: string;
  archiveExportMonth: string;
  onArchiveExportYear: (v: string) => void;
  onArchiveExportMonth: (v: string) => void;
  reports: PilotageReportListItem[];
  onRefreshVoucherArchives: () => void;
};

export function ArchivesDrawer({
  open,
  onClose,
  locale,
  voucherMonthArchives,
  traceabilityMonthLinks,
  archiveExportYear,
  archiveExportMonth,
  onArchiveExportYear,
  onArchiveExportMonth,
  reports,
  onRefreshVoucherArchives,
}: Props) {
  const t = useTranslations('Dashboard.bananoOmnipresent');

  if (!open) return null;

  const yNum = parseInt(archiveExportYear, 10);
  const mNum = parseInt(archiveExportMonth, 10);
  const traceMonth =
    Number.isFinite(yNum) && Number.isFinite(mNum) && mNum >= 1 && mNum <= 12
      ? `${yNum}-${String(mNum).padStart(2, '0')}`
      : '';

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label={t('close')}
        onClick={onClose}
      />
      <aside
        className="relative w-full max-w-md h-full bg-zinc-950 border-l border-zinc-700 shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal
        aria-labelledby="archives-drawer-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <h2 id="archives-drawer-title" className="text-sm font-bold text-zinc-50 uppercase tracking-wide">
            {t('archivesDrawerTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-[12px] border border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="p-4 space-y-8 text-sm text-zinc-200">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">{t('reportSectionTitle')}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{t('reportHelp')}</p>
            {reports.length === 0 ? (
              <p className="text-xs text-zinc-500">{t('reportEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {reports.slice(0, 24).map((r) => (
                  <li key={`${r.year}-${r.month}`}>
                    <a
                      href={`/api/banano/pilotage/reports/download?year=${r.year}&month=${r.month}&locale=${encodeURIComponent(locale)}`}
                      className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200 font-semibold text-xs"
                    >
                      {r.labelFr} {t('downloadArrow')}
                    </a>
                    {r.aiHeadline ? <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{r.aiHeadline}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">{t('voucherLoyaltyTitle')}</h3>
              <button
                type="button"
                onClick={() => onRefreshVoucherArchives()}
                className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 underline"
              >
                {t('archivesRefreshVouchers')}
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{t('voucherLoyaltyDesc')}</p>
            {voucherMonthArchives.loyalty.length === 0 ? (
              <p className="text-xs text-zinc-500">{t('reportEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {voucherMonthArchives.loyalty.map((row) => (
                  <li key={`loy-${row.year}-${row.month}`}>
                    <a
                      href={`/api/banano/crm/voucher-month-archives/download?year=${row.year}&month=${row.month}&kind=loyalty`}
                      className="text-amber-300 hover:text-amber-200 font-semibold text-xs"
                    >
                      {row.labelFr} {t('downloadCsv')}
                    </a>
                    <p className="text-[11px] text-zinc-500">{row.summaryLine}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">{t('voucherStaffTitle')}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{t('voucherStaffDesc')}</p>
            {voucherMonthArchives.staff.length === 0 ? (
              <p className="text-xs text-zinc-500">{t('reportEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {voucherMonthArchives.staff.map((row) => (
                  <li key={`st-${row.year}-${row.month}`}>
                    <a
                      href={`/api/banano/crm/voucher-month-archives/download?year=${row.year}&month=${row.month}&kind=staff`}
                      className="text-amber-300 hover:text-amber-200 font-semibold text-xs"
                    >
                      {row.labelFr} {t('downloadCsv')}
                    </a>
                    <p className="text-[11px] text-zinc-500">{row.summaryLine}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-200/90">{t('traceabilityCsvTitle')}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">{t('traceabilityCsvHelp')}</p>
            <div className="flex flex-wrap gap-2 items-end">
              <label className="text-[11px] text-zinc-400">
                {t('monthArchiveSelect')}
                <select
                  value={archiveExportMonth}
                  onChange={(e) => onArchiveExportMonth(e.target.value)}
                  className="mt-1 ml-1 min-h-[40px] px-2 rounded-[10px] border border-zinc-600 bg-zinc-800 text-zinc-100"
                >
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return (
                      <option key={m} value={m}>
                        {new Date(2000, i, 1).toLocaleDateString(locale, { month: 'long' })}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="text-[11px] text-zinc-400">
                {t('yearLabel')}
                <input
                  type="number"
                  min={2018}
                  max={2100}
                  value={archiveExportYear}
                  onChange={(e) => onArchiveExportYear(e.target.value)}
                  className="mt-1 ml-1 w-[5.5rem] min-h-[40px] px-2 rounded-[10px] border border-zinc-600 bg-zinc-800 text-zinc-100 tabular-nums"
                />
              </label>
            </div>
            {traceMonth ? (
              <a
                href={`/api/banano/activity-feed/export?month=${traceMonth}&locale=${encodeURIComponent(locale)}`}
                className="inline-flex min-h-[40px] items-center px-3 rounded-[12px] border border-zinc-600 bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
              >
                {t('downloadThisMonth')}
              </a>
            ) : null}
            {traceabilityMonthLinks.length > 0 ? (
              <ul className="space-y-1 text-[11px] text-zinc-500">
                {traceabilityMonthLinks.map((l) => (
                  <li key={l.ym}>
                    <a href={`/api/banano/activity-feed/export?month=${l.ym}`} className="text-amber-300/90 hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
}
