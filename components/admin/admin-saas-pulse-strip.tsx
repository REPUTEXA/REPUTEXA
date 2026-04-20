'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { LucideIcon } from 'lucide-react';
import { Euro, Gem, Percent, Target, TrendingUp } from 'lucide-react';
import type { SaasKpisPayload } from '@/lib/admin/saas-kpis';

const POLL_MS = 60_000;

type Props = {
  initial: SaasKpisPayload | null;
};

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

function fmtEur(n: number, locale: string): string {
  return new Intl.NumberFormat(numberFormatLocale(locale), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPercentPlain(n: number, locale: string): string {
  return `${n.toLocaleString(numberFormatLocale(locale), { maximumFractionDigits: 2 })}%`;
}

export function AdminSaasPulseStrip({ initial }: Props) {
  const t = useTranslations('Admin.saasPulse');
  const locale = useLocale();
  const [data, setData] = useState<SaasKpisPayload | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const mounted = useRef(true);
  const skipPoll = useRef(initial === null);

  const fetchKpis = useCallback(async () => {
    if (initial === null) return;
    try {
      const res = await fetch('/api/admin/saas-kpis', { credentials: 'same-origin' });
      const json = (await res.json()) as SaasKpisPayload & { error?: string };
      if (res.status === 503) {
        skipPoll.current = true;
        if (mounted.current) setErr(t('stripeMissing'));
        return;
      }
      if (!res.ok) {
        if (mounted.current) {
          setErr(typeof json.error === 'string' ? json.error : t('pollError'));
        }
        return;
      }
      if (!mounted.current) return;
      skipPoll.current = false;
      setData(json as SaasKpisPayload);
      setErr(null);
    } catch {
      if (mounted.current) setErr(t('pollError'));
    }
  }, [initial, t]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    void fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    const run = () => {
      if (skipPoll.current || document.visibilityState !== 'visible') return;
      void fetchKpis();
    };
    const id = window.setInterval(run, POLL_MS);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [fetchKpis]);

  const cards = useMemo(() => {
    const d = data;
    if (!d) return [];
    return [
      {
        id: 'mrr',
        label: t('cardMrr'),
        value: fmtEur(d.mrrEur, locale),
        icon: Euro,
        color: 'text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/20',
      },
      {
        id: 'churn',
        label: t('cardChurn'),
        value: d.logoChurnMonthlyPct != null ? fmtPercentPlain(d.logoChurnMonthlyPct, locale) : t('na'),
        icon: Percent,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10 border-amber-500/20',
      },
      {
        id: 'ltv',
        label: t('cardLtv'),
        value: d.estimatedLtvEur != null ? fmtEur(d.estimatedLtvEur, locale) : t('na'),
        icon: Gem,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10 border-violet-500/20',
      },
      {
        id: 'arpu',
        label: t('cardArpu'),
        value: d.arpuEur != null ? fmtEur(d.arpuEur, locale) : t('na'),
        icon: TrendingUp,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
      },
      {
        id: 'cpa',
        label: t('cardCpa'),
        value: d.cpaEur != null ? fmtEur(d.cpaEur, locale) : t('na'),
        icon: Target,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10 border-rose-500/20',
      },
    ] satisfies {
      id: string;
      label: string;
      value: string;
      icon: LucideIcon;
      color: string;
      bg: string;
    }[];
  }, [data, locale, t]);

  if (initial === null) {
    return (
      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">{t('sectionTitle')}</h2>
        <p className="text-sm text-zinc-600">{t('stripeMissing')}</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">{t('sectionTitle')}</h2>
      <p className="text-[11px] text-zinc-600 mb-4 max-w-3xl leading-relaxed">{t('sectionHint')}</p>
      {err ? <p className="text-xs text-amber-400/90 mb-3">{err}</p> : null}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(({ id, label, value, icon: Icon, color, bg }) => (
          <div
            key={id}
            className={`rounded-2xl border ${bg} px-4 py-3 flex flex-col gap-2 transition-[opacity] duration-200`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center border border-white/5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide leading-tight">{label}</p>
            </div>
            <p className="text-lg font-bold text-white tabular-nums leading-tight">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
