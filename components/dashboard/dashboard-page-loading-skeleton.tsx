'use client';

import { useTranslations } from 'next-intl';

/**
 * Skeleton pour la zone de contenu uniquement (sidebar/header déjà rendus par le layout).
 */
export function DashboardPageLoadingSkeleton() {
  const t = useTranslations('Dashboard.shell');
  return (
    <div
      className="max-w-[1600px] mx-auto space-y-6"
      aria-busy="true"
      aria-live="polite"
      aria-label={t('loading')}
    >
      <div className="h-8 w-48 rounded-lg bg-slate-200/70 dark:bg-zinc-800/70 animate-pulse" />
      <div className="h-10 w-64 max-w-full rounded-lg bg-slate-200/70 dark:bg-zinc-800/70 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-slate-200/70 dark:bg-zinc-800/70 animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-200/50 dark:bg-zinc-800/50 animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
