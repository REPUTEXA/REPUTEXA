'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CheckSquare, History, Loader2, Square, Undo2 } from 'lucide-react';
import type {
  OperatorChecklistId,
  OperatorChecklistLogEntry,
  OperatorChecklistStored,
} from '@/lib/admin/admin-operator-checklist';

const ITEMS: { id: OperatorChecklistId; href?: string; external?: boolean; hash?: string }[] = [
  { id: 'd_hub_pulse', href: '/dashboard/admin' },
  { id: 'd_security_badge', href: '/dashboard/admin/security-perfection' },
  { id: 'd_ghost_shield', href: '/dashboard/admin/security-perfection' },
  { id: 'd_nexus_slack', href: '/dashboard/admin/nexus-support' },
  { id: 'd_clients_fire', href: '/dashboard/admin#admin-clients' },
  { id: 'd_legal_guardian_inbox', href: '/dashboard/admin#legal-publish' },
  { id: 'w_security_audit', href: '/dashboard/admin/security-perfection' },
  { id: 'w_blackbox_sample', href: '/dashboard/admin/black-box-archive' },
  { id: 'w_ia_queue', href: '/dashboard/admin/ia-forge' },
  { id: 'w_guardian_stats', href: '/dashboard/admin/code-guardian' },
  { id: 'w_sentinel_compliance', href: '/dashboard/admin#sentinel-panel' },
  { id: 'w_council_digest', href: '/dashboard/admin#council-digest-heading' },
  {
    id: 'm_dpia_review',
    href: '/docs/compliance-audit-kit/README.md',
    external: true,
  },
  {
    id: 'm_subprocessors_csv',
    href: '/docs/compliance-audit-kit/liste-sous-traitants.csv',
    external: true,
  },
  { id: 'm_investor_archive', href: '/dashboard/admin' },
  { id: 'm_legal_pages', hash: '#pages-legales' },
  { id: 'm_vault_sentinel', href: '/dashboard/admin/security-perfection' },
  { id: 'm_billing_stripe', href: '/dashboard/admin' },
  { id: 'o_full_export', hash: '#exports-audit' },
  {
    id: 'o_drill_emergency',
    href: '/docs/compliance-audit-kit/README.md',
    external: true,
  },
  { id: 'o_access_review' },
  { id: 'o_external_audit_walk', hash: '#kit-fichiers' },
];

function prefixPeriod(id: OperatorChecklistId): 'daily' | 'weekly' | 'monthly' | 'one' {
  if (id.startsWith('d_')) return 'daily';
  if (id.startsWith('w_')) return 'weekly';
  if (id.startsWith('m_')) return 'monthly';
  return 'one';
}

/** Hors JSX : évite i18next/no-literal-string sur les clés de période (libellés via `t`). */
const OPERATOR_CHECKLIST_PERIODS = [
  { id: 'daily' as const, labelKey: 'operatorPeriodDaily' as const },
  { id: 'weekly' as const, labelKey: 'operatorPeriodWeekly' as const },
  { id: 'monthly' as const, labelKey: 'operatorPeriodMonthly' as const },
  { id: 'one' as const, labelKey: 'operatorPeriodOneTime' as const },
];

export function AdminOperatorChecklist() {
  const t = useTranslations('Dashboard.adminComplianceKit');
  const locale = useLocale();
  const [data, setData] = useState<OperatorChecklistStored | null>(null);
  const [ui, setUi] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [archiveNote, setArchiveNote] = useState('');
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateFmt = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const load = useCallback(async () => {
    setUi('loading');
    try {
      const res = await fetch('/api/admin/operator-checklist', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const json = (await res.json()) as OperatorChecklistStored;
      setData({
        ...json,
        log: json.log ?? [],
        snapshots: json.snapshots ?? [],
      });
      setUi('idle');
    } catch {
      setUi('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const persist = useCallback(
    async (body: {
      checked?: Partial<Record<OperatorChecklistId, boolean>>;
      reset?: 'daily' | 'weekly' | 'monthly';
      archiveSnapshot?: boolean;
      snapshotNote?: string | null;
    }): Promise<boolean> => {
      setUi('saving');
      try {
        const res = await fetch('/api/admin/operator-checklist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('patch');
        const json = (await res.json()) as OperatorChecklistStored;
        setData({
          ...json,
          log: json.log ?? [],
          snapshots: json.snapshots ?? [],
        });
        setUi('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setUi('idle'), 2000);
        return true;
      } catch {
        setUi('error');
        return false;
      }
    },
    []
  );

  const toggle = (id: OperatorChecklistId) => {
    const cur = data?.checked[id] === true;
    void persist({ checked: { [id]: !cur } as Partial<Record<OperatorChecklistId, boolean>> });
  };

  const archiveNow = () => {
    void (async () => {
      const note = archiveNote.trim() || null;
      const ok = await persist({ archiveSnapshot: true, snapshotNote: note });
      if (ok) setArchiveNote('');
    })();
  };

  const grouped = {
    daily: ITEMS.filter((i) => prefixPeriod(i.id) === 'daily'),
    weekly: ITEMS.filter((i) => prefixPeriod(i.id) === 'weekly'),
    monthly: ITEMS.filter((i) => prefixPeriod(i.id) === 'monthly'),
    one: ITEMS.filter((i) => prefixPeriod(i.id) === 'one'),
  } as const;

  const logLines = [...(data?.log ?? [])].reverse().slice(0, 48);

  const formatLogLine = (e: OperatorChecklistLogEntry) => {
    const kindLabel = t(`operatorLogKind_${e.kind}` as Parameters<typeof t>[0]);
    if (e.kind === 'check' || e.kind === 'uncheck') {
      const itemLabel = e.itemId ? t(`operatorItem_${e.itemId}` as Parameters<typeof t>[0]) : '';
      return `${kindLabel} · ${t('operatorLogItemPrefix')} : ${itemLabel}`;
    }
    if (e.kind === 'archive_snapshot') {
      const s = e.summary ? ` (${e.summary})` : '';
      const n = e.note ? ` — ${e.note}` : '';
      return `${kindLabel}${s}${n}`;
    }
    return kindLabel;
  };

  if (ui === 'loading' && !data) {
    return (
      <section
        id="fiche-operateur"
        className="scroll-mt-6 flex items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/20 py-12"
      >
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" aria-hidden />
      </section>
    );
  }

  return (
    <section id="fiche-operateur" className="scroll-mt-6 space-y-4">
      <div>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
          {t('sectionOperatorChecklist')}
        </h2>
        <p className="text-xs text-zinc-500 leading-relaxed">{t('operatorChecklistIntro')}</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-[10px] text-zinc-600 shrink-0">
            {ui === 'saving' && t('operatorSaving')}
            {ui === 'saved' && t('operatorSaved')}
            {ui === 'error' && t('operatorError')}
          </span>
          <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto overflow-y-hidden px-1 pb-0.5 touch-pan-x scroll-smooth [scrollbar-width:thin]">
            <button
              type="button"
              onClick={() => void persist({ reset: 'daily' })}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              {t('operatorResetDaily')}
            </button>
            <button
              type="button"
              onClick={() => void persist({ reset: 'weekly' })}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              {t('operatorResetWeekly')}
            </button>
            <button
              type="button"
              onClick={() => void persist({ reset: 'monthly' })}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors"
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              {t('operatorResetMonthly')}
            </button>
          </div>
        </div>
      </div>

      {OPERATOR_CHECKLIST_PERIODS.map(({ id, labelKey: periodLabelKey }) => {
        const rows = grouped[id];
        const label = t(periodLabelKey);
        return (
        <div key={id} className="rounded-2xl border border-zinc-800/80 overflow-hidden">
          <div className="bg-zinc-900/40 px-4 py-2 border-b border-zinc-800/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/90">{label}</p>
          </div>
          <ul className="divide-y divide-zinc-800/60">
            {rows.map((item) => {
              const checked = data?.checked[item.id] === true;
              const labelKey = `operatorItem_${item.id}` as Parameters<typeof t>[0];
              const hintKey = `itemHint_${item.id}` as Parameters<typeof t>[0];
              return (
                <li key={item.id} className="flex gap-3 px-4 py-3 hover:bg-zinc-900/25 transition-colors">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="mt-0.5 flex-shrink-0 text-emerald-500/90 hover:text-emerald-400 transition-colors"
                    aria-pressed={checked}
                    aria-label={checked ? t('operatorAriaChecked') : t('operatorAriaUnchecked')}
                  >
                    {checked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-zinc-600" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 leading-snug">{t(labelKey)}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">{t(hintKey)}</p>
                    <div className="mt-2 -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-0.5 touch-pan-x [scrollbar-width:thin]">
                      {item.hash === '#pages-legales' ? (
                        <a
                          href={item.hash}
                          className="shrink-0 text-[11px] font-medium text-emerald-500/90 hover:text-emerald-400 whitespace-nowrap"
                        >
                          {t('operatorLinkLegal')}
                        </a>
                      ) : null}
                      {item.hash === '#exports-audit' ? (
                        <a
                          href={item.hash}
                          className="shrink-0 text-[11px] font-medium text-emerald-500/90 hover:text-emerald-400 whitespace-nowrap"
                        >
                          {t('operatorLinkExports')}
                        </a>
                      ) : null}
                      {item.hash === '#kit-fichiers' ? (
                        <a
                          href={item.hash}
                          className="shrink-0 text-[11px] font-medium text-emerald-500/90 hover:text-emerald-400 whitespace-nowrap"
                        >
                          {t('operatorLinkDoc')}
                        </a>
                      ) : null}
                      {item.href && item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[11px] font-medium text-emerald-500/90 hover:text-emerald-400 whitespace-nowrap"
                        >
                          {t('operatorLinkDoc')}
                        </a>
                      ) : null}
                      {item.href && !item.external ? (
                        <Link
                          href={item.href}
                          className="shrink-0 text-[11px] font-medium text-emerald-500/90 hover:text-emerald-400 whitespace-nowrap"
                        >
                          {item.href.includes('#') ? t('operatorLinkPanel') : t('operatorLinkAdmin')}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        );
      })}

      <div
        id="fiche-tracabilite"
        className="scroll-mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/20 overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
          <History className="h-4 w-4 text-emerald-500/90 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{t('operatorTraceTitle')}</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">{t('operatorTraceIntro')}</p>
          </div>
        </div>

        <div className="space-y-4 p-4 border-b border-zinc-800/60">
          <p className="text-[11px] text-zinc-500 leading-relaxed">{t('operatorArchiveHelp')}</p>
          <textarea
            value={archiveNote}
            onChange={(e) => setArchiveNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t('operatorArchiveNotePlaceholder')}
            className="w-full max-w-xl rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="button"
            onClick={() => archiveNow()}
            disabled={ui === 'saving'}
            className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/40 disabled:opacity-50"
          >
            {t('operatorArchiveButton')}
          </button>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800/60">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            {t('operatorSnapshotsTitle')}
          </h4>
          {(data?.snapshots ?? []).length === 0 ? (
            <p className="text-xs text-zinc-600">{t('operatorNoSnapshots')}</p>
          ) : (
            <ul className="space-y-2 max-h-40 overflow-y-auto overscroll-contain">
              {[...(data?.snapshots ?? [])]
                .reverse()
                .slice(0, 12)
                .map((s, i) => (
                  <li
                    key={`${s.at}-${i}`}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-400"
                  >
                    <span className="font-mono text-[10px] text-zinc-500">{dateFmt(s.at)}</span>
                    <span className="block text-zinc-300 mt-0.5">
                      {t('operatorSnapshotLine', {
                        done: s.doneCount,
                        total: s.totalSlots,
                      })}
                    </span>
                    {s.note ? <p className="mt-1 text-zinc-500 break-words whitespace-normal leading-snug">{s.note}</p> : null}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            {t('operatorLogJournalTitle')}
          </h4>
          {logLines.length === 0 ? (
            <p className="text-xs text-zinc-600">{t('operatorNoLog')}</p>
          ) : (
            <ul className="space-y-1.5 max-h-[min(280px,40vh)] overflow-y-auto overscroll-contain text-xs text-zinc-400">
              {logLines.map((e, i) => (
                <li key={`${e.at}-${e.kind}-${e.itemId ?? ''}-${i}`} className="border-l-2 border-zinc-700/80 pl-2">
                  <span className="font-mono text-[10px] text-zinc-600">{dateFmt(e.at)}</span>
                  <span className="block text-zinc-400 leading-snug">{formatLogLine(e)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
