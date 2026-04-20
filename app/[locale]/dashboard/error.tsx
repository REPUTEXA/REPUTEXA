'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Dashboard.error');

  useEffect(() => {
    console.error('[dashboard/error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-800 dark:text-zinc-100 text-base">
          {t('title')}
        </p>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">
          {error.message?.trim() ? error.message : t('fallbackMessage')}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
      >
        <RefreshCw className="w-4 h-4" />
        {t('retry')}
      </button>
    </div>
  );
}
