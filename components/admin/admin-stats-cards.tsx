'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Users, Star, FileText } from 'lucide-react';

type Stats = {
  totalUsers: number;
  totalAiReviews: number;
  totalLegalVersions: number;
};

type Props = {
  initial: Stats;
};

const POLL_MS = 1000;

const NUMBER_LOCALE_BY_APP: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

function numberFormatLocale(locale: string): string {
  return NUMBER_LOCALE_BY_APP[locale] ?? 'fr-FR';
}

export function AdminStatsCards({ initial }: Props) {
  const t = useTranslations('Admin.statsCards');
  const locale = useLocale();
  const numLocale = numberFormatLocale(locale);
  const [stats, setStats] = useState<Stats>(initial);
  const mounted = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
      if (!res.ok) return;
      const json = (await res.json()) as Stats;
      if (!mounted.current) return;
      setStats({
        totalUsers: json.totalUsers ?? 0,
        totalAiReviews: json.totalAiReviews ?? 0,
        totalLegalVersions: json.totalLegalVersions ?? 0,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchStats();
    };
    const id = setInterval(run, POLL_MS);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [fetchStats]);

  const cards = useMemo(
    () =>
      [
        {
          id: 'users',
          label: t('statsCardUsers'),
          value: stats.totalUsers,
          icon: Users,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border-blue-500/20',
        },
        {
          id: 'aiReviews',
          label: t('statsCardAiReviews'),
          value: stats.totalAiReviews,
          icon: Star,
          color: 'text-violet-400',
          bg: 'bg-violet-500/10 border-violet-500/20',
        },
        {
          id: 'legalDocs',
          label: t('statsCardLegalDocs'),
          value: stats.totalLegalVersions,
          icon: FileText,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
        },
      ] satisfies {
        id: string;
        label: string;
        value: number;
        icon: LucideIcon;
        color: string;
        bg: string;
      }[],
    [stats.totalAiReviews, stats.totalLegalVersions, stats.totalUsers, t],
  );

  return (
    <section>
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">{t('sectionTitle')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ id, label, value, icon: Icon, color, bg }) => (
          <div
            key={id}
            className={`rounded-2xl border ${bg} px-5 py-4 flex items-center gap-4 transition-[opacity] duration-200`}
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">
                {value.toLocaleString(numLocale)}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
