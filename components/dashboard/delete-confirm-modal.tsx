'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

export type DeleteConfirmModalProps = {
  open: boolean;
  /** Titre principal (H2) */
  headline: string;
  /** Contenu sous le titre (paragraphes, etc.) */
  children: React.ReactNode;
  /** Encadré violet type + titre (comme « Communiqué » sur les mises à jour) */
  preview?: { label: string; title: string };
  /** Ligne d’avertissement optionnelle (ex. texte rouge) */
  warning?: React.ReactNode;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  /** id pour aria-labelledby */
  titleId?: string;
  descId?: string;
};

/**
 * Modale de confirmation de suppression — même design que la page Mises à jour (dashboard).
 */
export function DeleteConfirmModal({
  open,
  headline,
  children,
  preview,
  warning,
  confirming,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  titleId = 'delete-confirm-title',
  descId = 'delete-confirm-desc',
}: DeleteConfirmModalProps) {
  const td = useTranslations('Dashboard.deleteModal');
  const cancelText = cancelLabel ?? td('cancel');
  const confirmText = confirmLabel ?? td('confirmDelete');
  const close = useCallback(() => {
    if (confirming) return;
    onCancel();
  }, [confirming, onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button
        type="button"
        aria-label={td('closeAria')}
        className="absolute inset-0 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={close}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.35),0_0_40px_-12px_rgba(239,68,68,0.25)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.65),0_0_50px_-10px_rgba(239,68,68,0.2)] overflow-hidden animate-fade-up ring-1 ring-red-500/10"
      >
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={close}
            disabled={confirming}
            aria-label={td('closeAria')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="p-6 sm:p-8 pt-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 dark:bg-red-500/15 ring-1 ring-red-500/20 mb-5">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" strokeWidth={2} />
          </div>
          <h2
            id={titleId}
            className="font-display font-bold text-lg sm:text-xl text-slate-900 dark:text-zinc-50 pr-8"
          >
            {headline}
          </h2>
          <div id={descId} className="mt-2 text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            {children}
          </div>
          {warning && <div className="mt-3">{warning}</div>}
          {preview && (
            <div className="mt-4 rounded-xl border border-violet-200/80 dark:border-violet-500/20 bg-violet-50/50 dark:bg-violet-950/30 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
                {preview.label}
              </p>
              <p className="text-sm font-medium text-slate-900 dark:text-zinc-100 line-clamp-3">{preview.title}</p>
            </div>
          )}
          <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={close}
              disabled={confirming}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={confirming}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg shadow-red-900/20 dark:shadow-red-950/40 transition-all disabled:opacity-60 disabled:pointer-events-none"
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
