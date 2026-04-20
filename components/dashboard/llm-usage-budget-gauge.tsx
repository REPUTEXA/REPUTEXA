import { getTranslations } from 'next-intl/server';
import { Gauge } from 'lucide-react';

type Props = {
  count: number;
  softLimit: number;
  hardLimit: number;
};

export async function LlmUsageBudgetGauge({ count, softLimit, hardLimit }: Props) {
  const t = await getTranslations('Dashboard.llmBudget');
  const soft = Math.max(1, softLimit);
  const hard = Math.max(soft + 1, hardLimit);
  const pctHard = Math.min(100, (count / hard) * 100);
  const softMarkerPct = (soft / hard) * 100;

  let status: 'ok' | 'soft' | 'hard' = 'ok';
  if (count >= hard) status = 'hard';
  else if (count >= soft) status = 'soft';

  const fillClass =
    status === 'hard'
      ? 'bg-red-500 dark:bg-red-500'
      : status === 'soft'
        ? 'bg-amber-500 dark:bg-amber-500'
        : 'bg-emerald-500 dark:bg-emerald-400';

  return (
    <section
      className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] shadow-sm dark:shadow-[4px_6px_0_rgba(0,0,0,0.5)] p-4 sm:p-5"
      aria-label={t('title')}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400">
            <Gauge className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-slate-900 dark:text-zinc-100 text-sm sm:text-base">
              {t('title')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{t('subtitle')}</p>
          </div>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-slate-900 dark:text-zinc-100">
            {t('usedOfSoft', { count, soft })}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            {t('hardCap', { hard })}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div
          className="relative h-3 w-full rounded-full bg-slate-200/80 dark:bg-zinc-800 overflow-hidden"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={hard}
          aria-valuenow={count}
          aria-label={t('meterAria', { count, hard })}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${fillClass}`}
            style={{ width: `${pctHard}%` }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-slate-900/25 dark:bg-zinc-100/35 pointer-events-none"
            style={{ left: `${Math.min(99.5, softMarkerPct)}%` }}
            title={t('softMarkerTitle', { soft })}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {t('legendComfort')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            {t('legendThrottle')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            {t('legendHard')}
          </span>
        </div>
      </div>

      <p
        className={`mt-3 text-xs font-medium ${
          status === 'hard'
            ? 'text-red-600 dark:text-red-400'
            : status === 'soft'
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-emerald-700 dark:text-emerald-400'
        }`}
      >
        {status === 'hard' ? t('statusHard') : status === 'soft' ? t('statusSoft') : t('statusOk')}
      </p>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80 pt-3">
        {t('explanation')}
      </p>
    </section>
  );
}
