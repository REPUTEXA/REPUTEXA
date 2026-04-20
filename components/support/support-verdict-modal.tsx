'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Scale } from 'lucide-react';
import { AdminModalPortal } from '@/components/admin/admin-modal-portal';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (problem: string, solution: string) => void | Promise<void>;
  title?: string;
  confirmLabel?: string;
};

export function SupportVerdictModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  confirmLabel,
}: Props) {
  const t = useTranslations('Dashboard.supportVerdict');
  const resolvedTitle = title ?? t('defaultTitle');
  const resolvedConfirm = confirmLabel ?? t('defaultConfirm');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!problem.trim() || !solution.trim()) return;
    setBusy(true);
    try {
      await onConfirm(problem.trim(), solution.trim());
      setProblem('');
      setSolution('');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModalPortal>
      <div
        className="fixed inset-0 z-[8500] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verdict-modal-title"
      >
        <div className="w-full max-w-lg rounded-2xl border border-zinc-700/80 bg-zinc-900 text-zinc-100 shadow-2xl">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-violet-600/25 border border-violet-500/35 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <h2 id="verdict-modal-title" className="text-sm font-semibold text-white">
                  {resolvedTitle}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t('subtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !busy && onOpenChange(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              aria-label={t('closeAria')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 space-y-4">
            <div>
              <label htmlFor="verdict-problem" className="block text-xs font-medium text-zinc-400 mb-1.5">
                {t('problemLabel')}
              </label>
              <textarea
                id="verdict-problem"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder={t('problemPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="verdict-solution" className="block text-xs font-medium text-zinc-400 mb-1.5">
                {t('solutionLabel')}
              </label>
              <textarea
                id="verdict-solution"
                value={solution}
                onChange={(e) => setSolution(e.target.value)}
                rows={3}
                required
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                placeholder={t('solutionPlaceholder')}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={busy || !problem.trim() || !solution.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white transition-colors"
              >
                {busy ? '…' : resolvedConfirm}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AdminModalPortal>
  );
}
