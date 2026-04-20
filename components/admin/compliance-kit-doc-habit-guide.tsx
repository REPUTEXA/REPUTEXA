'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckSquare, Square } from 'lucide-react';

const STORAGE_KEY = 'compliance-kit-doc-habits-v1';

type HabitId =
  | 'd_readme'
  | 'd_legal_glance'
  | 'w_guide'
  | 'w_fortresse'
  | 'm_csv'
  | 'm_registre'
  | 'm_export_sample'
  | 'b_law'
  | 'b_dpa'
  | 'b_human_trace';

const GROUPS: { period: 'daily' | 'weekly' | 'monthly' | 'beyond'; ids: HabitId[] }[] = [
  { period: 'daily', ids: ['d_readme', 'd_legal_glance'] },
  { period: 'weekly', ids: ['w_guide', 'w_fortresse'] },
  { period: 'monthly', ids: ['m_csv', 'm_registre', 'm_export_sample'] },
  { period: 'beyond', ids: ['b_law', 'b_dpa', 'b_human_trace'] },
];

function loadStored(): Partial<Record<HabitId, boolean>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as { checked?: Record<string, boolean> };
    if (!o.checked || typeof o.checked !== 'object') return {};
    const out: Partial<Record<HabitId, boolean>> = {};
    for (const id of Object.keys(o.checked) as HabitId[]) {
      if (GROUPS.some((g) => g.ids.includes(id)) && o.checked[id] === true) out[id] = true;
    }
    return out;
  } catch {
    return {};
  }
}

function saveStored(checked: Partial<Record<HabitId, boolean>>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ checked, updatedAt: new Date().toISOString() }));
  } catch {
    /* ignore quota */
  }
}

export function ComplianceKitDocHabitGuide() {
  const t = useTranslations('Dashboard.adminComplianceKit');
  const [checked, setChecked] = useState<Partial<Record<HabitId, boolean>>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChecked(loadStored());
    setReady(true);
  }, []);

  const toggle = useCallback((id: HabitId) => {
    setChecked((prev) => {
      const next = { ...prev };
      if (next[id] === true) delete next[id];
      else next[id] = true;
      saveStored(next);
      return next;
    });
  }, []);

  const resetMonth = useCallback(() => {
    setChecked((prev) => {
      const next = { ...prev };
      for (const id of ['m_csv', 'm_registre', 'm_export_sample', 'b_human_trace'] as HabitId[]) {
        delete next[id];
      }
      saveStored(next);
      return next;
    });
  }, []);

  const periodTitle = useMemo(
    () => ({
      daily: t('habitDocPeriodDaily'),
      weekly: t('habitDocPeriodWeekly'),
      monthly: t('habitDocPeriodMonthly'),
      beyond: t('habitDocPeriodBeyond'),
    }),
    [t]
  );

  if (!ready) return null;

  return (
    <section id="guide-habitudes" className="scroll-mt-6 space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">{t('sectionDocHabitsTitle')}</h2>
        <p className="text-xs text-zinc-500 leading-relaxed">{t('sectionDocHabitsIntro')}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 overflow-hidden divide-y divide-zinc-800/60">
        {GROUPS.map(({ period, ids }) => (
          <div key={period} className="px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-500/90">{periodTitle[period]}</p>
            <ul className="space-y-2">
              {ids.map((id) => {
                const isOn = checked[id] === true;
                const labelKey = `habitDoc_${id}` as Parameters<typeof t>[0];
                const hintKey = `habitDocHint_${id}` as Parameters<typeof t>[0];
                return (
                  <li key={id} className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      className="mt-0.5 shrink-0 text-sky-500/90 hover:text-sky-400"
                      aria-pressed={isOn}
                    >
                      {isOn ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-zinc-600" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 leading-snug">{t(labelKey)}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{t(hintKey)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resetMonth}
          className="rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
        >
          {t('habitDocResetMonthly')}
        </button>
        <span className="text-[10px] text-zinc-600">{t('habitDocLocalNote')}</span>
      </div>

      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 space-y-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-violet-300/90">{t('sectionBeyondAppTitle')}</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">{t('sectionBeyondAppIntro')}</p>
        <ul className="text-[11px] text-zinc-500 space-y-1.5 list-disc pl-4 leading-relaxed">
          <li>{t('beyondBulletLaw')}</li>
          <li>{t('beyondBulletDpa')}</li>
          <li>{t('beyondBulletDrive')}</li>
          <li>{t('beyondBulletHabit')}</li>
        </ul>
      </div>
    </section>
  );
}
