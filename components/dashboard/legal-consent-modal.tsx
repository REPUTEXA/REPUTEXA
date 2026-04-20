'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { FileText, Lock, Loader2, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LegalConsentModalProps {
  open: boolean;
  currentVersion: number;
  summaryOfChanges: string;
  effectiveDateFormatted: string;
  /** Document précis mis à jour (ex. CGU seule). */
  documentLabel?: string;
  onAccepted: () => void;
}

export function LegalConsentModal({
  open,
  currentVersion,
  summaryOfChanges,
  effectiveDateFormatted,
  documentLabel = '',
  onAccepted,
}: LegalConsentModalProps) {
  const t = useTranslations('Dashboard.legalUpdateModal');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/accept-legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: currentVersion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t('errorGeneric'));
      }
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorGeneric'));
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[10px] motion-safe:transition-opacity" />

      <div className="relative w-full max-w-[28rem] rounded-[1.25rem] bg-white dark:bg-zinc-900 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-black/[0.06] dark:ring-white/[0.08] overflow-hidden">
        <div className="px-6 pt-6 pb-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500 mb-2">
            {t('brandLine')}
          </p>
          <h2
            id="legal-modal-title"
            className="text-[1.375rem] font-semibold tracking-tight text-slate-900 dark:text-zinc-50 leading-snug"
          >
            {t('title')}
          </h2>
          <p className="mt-3 text-[15px] text-slate-600 dark:text-zinc-400 leading-relaxed">
            {t('body', { date: effectiveDateFormatted })}
          </p>
          {documentLabel ? (
            <p className="mt-2 text-sm font-medium text-slate-800 dark:text-zinc-200">
              {t('docConcerned', { doc: documentLabel })}
            </p>
          ) : null}
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 px-4 py-3.5 ring-1 ring-slate-200/80 dark:ring-zinc-700/60">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400 mb-1.5">
              {t('summaryLabel')}
            </p>
            <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
              {summaryOfChanges}
            </p>
          </div>

          {!documentLabel ? (
            <ul className="space-y-2">
              {[
                { label: t('docTerms'), icon: FileText },
                { label: t('docPrivacy'), icon: Lock },
              ].map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 text-sm text-slate-600 dark:text-zinc-400"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 ring-1 ring-slate-200/60 dark:ring-zinc-700/50">
                    <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-500" aria-hidden />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href="/legal"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8] dark:text-blue-400 dark:hover:text-blue-300 transition-colors group"
          >
            {t('viewFull')}
            <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          </Link>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/35 rounded-xl px-3.5 py-2.5 ring-1 ring-red-200/80 dark:ring-red-900/50"
            >
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 pt-1">
          <p className="text-[12px] text-slate-500 dark:text-zinc-500 leading-relaxed mb-4">
            {t('footnote')}
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl text-[15px] font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-55 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 active:scale-[0.99] transition-[transform,background-color,opacity] duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                {t('submitLoading')}
              </>
            ) : (
              t('submit')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
