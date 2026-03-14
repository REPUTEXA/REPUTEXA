'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { subDays, subMonths, startOfDay } from 'date-fns';
import { Calendar } from 'lucide-react';

type QuickRangeKey = '7d' | '30d' | '3m' | '12m';

const QUICK_RANGES: { key: QuickRangeKey; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '3m', label: '3 mois' },
  { key: '12m', label: '12 mois' },
];

function formatDateParam(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DashboardDateRangePicker() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from ?? '');
  const [localTo, setLocalTo] = useState(to ?? '');

  useEffect(() => {
    setLocalFrom(from ?? '');
    setLocalTo(to ?? '');
  }, [from, to]);

  const activeKey: QuickRangeKey | null = useMemo(() => {
    const period = searchParams.get('period') as QuickRangeKey | null;
    return period && ['7d', '30d', '3m', '12m'].includes(period) ? period : null;
  }, [searchParams]);

  const applyRangeToUrl = useCallback(
    (fromDate: Date, toDate: Date, period: QuickRangeKey | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('from', formatDateParam(fromDate));
      params.set('to', formatDateParam(toDate));
      if (period) params.set('period', period);
      else params.delete('period');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const handleSelectRange = useCallback(
    (key: QuickRangeKey) => {
      const today = startOfDay(new Date());
      let from: Date;
      if (key === '7d') {
        from = subDays(today, 6);
      } else if (key === '30d') {
        from = subDays(today, 29);
      } else if (key === '3m') {
        from = subMonths(today, 3);
      } else {
        from = subMonths(today, 12);
      }

      applyRangeToUrl(from, today, key);
    },
    [applyRangeToUrl],
  );

  const handleApplyCustom = useCallback(() => {
    if (!localFrom || !localTo) return;
    const fromDate = new Date(localFrom);
    const toDate = new Date(localTo);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return;
    const start = fromDate <= toDate ? fromDate : toDate;
    const end = fromDate <= toDate ? toDate : fromDate;
    applyRangeToUrl(startOfDay(start), startOfDay(end), null);
    setOpen(false);
  }, [applyRangeToUrl, localFrom, localTo]);

  const handleReset = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    params.delete('to');
    params.delete('period');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setOpen(false);
  }, [pathname, router, searchParams]);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/70 px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-300 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span className="font-medium">
            Période :
            {' '}
            {from && to ? `${from} → ${to}` : 'Derniers avis'}
          </span>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-3 text-xs text-slate-600 dark:text-zinc-200">
            <p className="mb-2 font-semibold text-slate-700 dark:text-zinc-100">Sélection personnalisée</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">Du</span>
                <input
                  type="date"
                  value={localFrom}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalFrom(value);
                    if (value && localTo) {
                      const fromDate = new Date(value);
                      const toDate = new Date(localTo);
                      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
                        const start = fromDate <= toDate ? fromDate : toDate;
                        const end = fromDate <= toDate ? toDate : fromDate;
                        applyRangeToUrl(startOfDay(start), startOfDay(end), null);
                      }
                    }
                  }}
                  className="w-44 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">Au</span>
                <input
                  type="date"
                  value={localTo}
                  onChange={(e) => {
                    const value = e.target.value;
                    setLocalTo(value);
                    if (localFrom && value) {
                      const fromDate = new Date(localFrom);
                      const toDate = new Date(value);
                      if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
                        const start = fromDate <= toDate ? fromDate : toDate;
                        const end = fromDate <= toDate ? toDate : fromDate;
                        applyRangeToUrl(startOfDay(start), startOfDay(end), null);
                      }
                    }
                  }}
                  className="w-44 px-2 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                />
              </div>
              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-full px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  Réinitialiser
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-3 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    className="rounded-full bg-sky-600 px-3 py-0.5 text-[11px] font-semibold text-white hover:bg-sky-700"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_RANGES.map((range) => (
          <button
            key={range.key}
            type="button"
            onClick={() => handleSelectRange(range.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              activeKey === range.key
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}

