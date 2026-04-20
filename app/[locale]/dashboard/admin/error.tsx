'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Dashboard.adminError');

  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-red-500/25 bg-red-950/30">
        <AlertCircle className="h-7 w-7 text-red-400/90" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-white">{t('title')}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        {error.message?.trim() ? error.message : t('fallbackMessage')}
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-[10px] text-zinc-600">
          {t('refPrefix')} {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <RefreshCw className="h-4 w-4" />
          {t('retry')}
        </button>
      </div>
    </div>
  );
}
