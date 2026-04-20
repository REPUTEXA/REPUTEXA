'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Crown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { BananoEliteRewardSettings } from '@/lib/banano/loyalty-profile';

function parseRatePerEuro(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return 0;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(100_000, x);
}

export function BananoEliteRewardSettings({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations('Dashboard.bananoEliteRewardSettings');
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [euroStr, setEuroStr] = useState('');
  const [validityDays, setValidityDays] = useState('');
  const [template, setTemplate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banano/loyalty/settings');
      const data = (await res.json()) as {
        loyalty?: { eliteReward: BananoEliteRewardSettings };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      const er = data.loyalty?.eliteReward;
      if (er) {
        setEnabled(er.enabled);
        setEuroStr(er.euroCents > 0 ? String(er.euroCents / 100) : '');
        setValidityDays(er.validityDays != null ? String(er.validityDays) : '');
        setTemplate(er.whatsappTemplate ?? '');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    let valOut: number | null = null;
    if (enabled) {
      const cents = Math.round(Math.max(0, parseRatePerEuro(euroStr)) * 100);
      if (cents < 1) {
        toast.error(t('errAmount'));
        return;
      }
      const vd = validityDays.trim();
      if (vd) {
        const n = Math.floor(parseInt(vd, 10));
        if (!Number.isFinite(n) || n < 1 || n > 3650) {
          toast.error(t('errValidity'));
          return;
        }
        valOut = n;
      }
    }

    setSaveBusy(true);
    try {
      const res = await fetch('/api/banano/loyalty/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eliteRewardEnabled: enabled,
          eliteRewardEuroCents: enabled ? Math.round(Math.max(0, parseRatePerEuro(euroStr)) * 100) : 0,
          eliteRewardValidityDays: enabled ? valOut : null,
          eliteRewardWhatsAppTemplate: template.trim().length > 0 ? template.trim() : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t('errGeneric'));
      toast.success(t('toastSaved'));
      onSaved?.();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errGeneric'));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100">
        <Crown className="w-5 h-5 shrink-0" />
        <h3 className="text-sm font-bold uppercase tracking-wide">{t('title')}</h3>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t('intro')}</p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('loading')}
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t('enabledLabel')}
          </label>

          {enabled ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  {t('amountLabel')}
                  <input
                    value={euroStr}
                    onChange={(e) => setEuroStr(e.target.value)}
                    inputMode="decimal"
                    placeholder={t('amountPlaceholder')}
                    className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
                <label className="block text-xs text-slate-600 dark:text-slate-400">
                  {t('validityLabel')}
                  <input
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    placeholder={t('validityPlaceholder')}
                    className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-600 dark:text-slate-400">
                {t('templateLabel')}
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value.slice(0, 4000))}
                  rows={6}
                  placeholder={t('templatePlaceholder')}
                  className="mt-1 w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-mono leading-relaxed"
                />
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('variablesHelp')}</p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 px-3 py-2">
              {t('disabledHint')}
            </p>
          )}

          <button
            type="button"
            disabled={saveBusy}
            onClick={() => void save()}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-lg bg-amber-600 hover:bg-amber-600/90 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('save')}
          </button>
        </div>
      )}
    </section>
  );
}
