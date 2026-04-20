'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Radio, Trophy } from 'lucide-react';

type Payload = {
  title: string;
  establishmentName: string;
  startsAt: string | null;
  endsAt: string | null;
  periodActive: boolean;
  totalPoints: number;
  leaderboard: { name: string; points: number }[];
};

type Props = { token: string; locale: string };

function formatDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ReputexaTeamBoardClient({ token, locale }: Props) {
  const t = useTranslations('PublicDefiTeam');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/reputexa-team/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (!res.ok) {
        setError(t('notFound'));
        setData(null);
        return;
      }
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError(t('loadError'));
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 25_000);
    return () => clearInterval(id);
  }, [load]);

  if (error && !data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4 text-center text-slate-600 dark:text-slate-400">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center gap-2 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-8">
      <header className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          <Trophy className="w-3.5 h-3.5" aria-hidden />
          REPUTEXA
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{data.title}</h1>
        {data.establishmentName && (
          <p className="text-slate-600 dark:text-slate-400 font-medium">{data.establishmentName}</p>
        )}
        {data.periodActive && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <Radio className="w-4 h-4 animate-pulse" aria-hidden />
            {t('live')}
          </p>
        )}
      </header>

      {(data.startsAt || data.endsAt) && (
        <p className="text-center text-sm text-slate-500">
          {formatDate(data.startsAt, locale)} → {formatDate(data.endsAt, locale)}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{t('totalPointsLabel')}</p>
        <p className="text-3xl font-bold text-primary tabular-nums">{data.totalPoints}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-900 dark:text-white">{t('leaderboard')}</h2>
        {data.leaderboard.length === 0 ? (
          <p className="text-sm text-slate-500">{t('empty')}</p>
        ) : (
          <ol className="space-y-2">
            {data.leaderboard.map((row, i) => (
              <li
                key={row.name}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-zinc-800 px-3 py-2.5 bg-slate-50/80 dark:bg-zinc-900/50"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs font-bold mr-2">
                    {i + 1}
                  </span>
                  {row.name}
                </span>
                <span className="text-lg font-bold text-primary tabular-nums">{row.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">{t('refreshHint')}</p>
    </div>
  );
}
