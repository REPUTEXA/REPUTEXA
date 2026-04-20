'use client';

import { FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VoucherMonthArchiveListItem } from '@/lib/banano/voucher-month-archive-types';

type Props = {
  title: string;
  description: string;
  /** `loyalty` → kind=loyalty ; `staff` → kind=staff (API). */
  downloadKind: 'loyalty' | 'staff';
  items: VoucherMonthArchiveListItem[];
  variant: 'emerald' | 'violet';
};

const ring = {
  emerald: 'border-emerald-600 bg-emerald-600/5 dark:bg-emerald-600/10 ring-2 ring-emerald-600/25',
  violet: 'border-violet-600 bg-violet-600/5 dark:bg-violet-600/10 ring-2 ring-violet-600/25',
} as const;

const icon = {
  emerald: 'text-emerald-700 dark:text-emerald-400',
  violet: 'text-violet-700 dark:text-violet-400',
} as const;

export function VoucherMonthArchiveStrip({ title, description, downloadKind, items, variant }: Props) {
  const q = downloadKind === 'staff' ? 'staff' : 'loyalty';
  const t = useTranslations('Dashboard.bananoVoucherArchive');

  return (
    <section
      className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-sm space-y-4"
      aria-label={title}
    >
      <div className={`flex items-center gap-2 ${icon[variant]}`}>
        <FileSpreadsheet className="w-5 h-5 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wide">{title}</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center border border-dashed border-slate-200 dark:border-zinc-700 rounded-xl leading-relaxed">
          {t('emptyArchive')}
        </p>
      ) : (
        <div className="flex flex-row gap-3 overflow-x-auto pb-2 pt-1 -mx-1 px-1 snap-x snap-mandatory">
          {items.map((r, idx) => (
            <a
              key={`${r.year}-${r.month}-${downloadKind}`}
              href={`/api/banano/crm/voucher-month-archives/download?year=${r.year}&month=${r.month}&kind=${q}`}
              className={`snap-start shrink-0 w-[min(100%,17.5rem)] rounded-2xl border p-4 min-h-[120px] flex flex-col justify-between transition-shadow hover:shadow-md ${
                idx === 0 ? ring[variant] : 'border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/40'
              }`}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {idx === 0 ? t('lastMonthArchived') : t('archive')}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-50 mt-1">{r.labelFr}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 leading-snug line-clamp-3">
                  {r.summaryLine}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 tabular-nums">
                  {t('rowsCount', { count: r.rowCount })}
                </p>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-3">{t('downloadCsv')}</p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
