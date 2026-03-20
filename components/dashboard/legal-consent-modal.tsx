'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck, ExternalLink, FileText, Lock, Loader2 } from 'lucide-react';

interface LegalConsentModalProps {
  open: boolean;
  currentVersion: number;
  summaryOfChanges: string;
  effectiveDateFormatted: string;
  onAccepted: () => void;
}

export function LegalConsentModal({
  open,
  currentVersion,
  summaryOfChanges,
  effectiveDateFormatted,
  onAccepted,
}: LegalConsentModalProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';

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
        throw new Error(data.error ?? 'Erreur serveur');
      }
      onAccepted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.');
      setLoading(false);
    }
  }

  const legalUrl = `/${locale}/legal`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header band */}
        <div className="bg-[#2563eb] px-6 py-5 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-100 uppercase tracking-wider">REPUTEXA</p>
            <h2
              id="legal-modal-title"
              className="text-lg font-bold text-white leading-tight"
            >
              Mise à jour de nos conditions
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
            Nos documents légaux ont été mis à jour. Ces modifications entrent en vigueur le{' '}
            <strong className="text-slate-900 dark:text-white">{effectiveDateFormatted}</strong>.
          </p>

          {/* Summary */}
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2">
              Résumé des changements
            </p>
            <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
              {summaryOfChanges}
            </p>
          </div>

          {/* Documents list */}
          <div className="flex flex-col gap-2">
            {[
              { label: 'Conditions Générales d\'Utilisation', icon: FileText },
              { label: 'Politique de Confidentialité', icon: Lock },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-zinc-400"
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-slate-400 dark:text-zinc-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <a
            href={legalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#2563eb] hover:underline font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Consulter les documents complets
          </a>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4 leading-relaxed">
            En cliquant sur « J&apos;accepte et continue », vous confirmez avoir pris connaissance
            et accepter les nouvelles conditions. Sans votre acceptation, l&apos;accès au tableau
            de bord restera suspendu.
          </p>
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl font-semibold text-white text-sm bg-[#2563eb] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 dark:focus:ring-offset-zinc-900 active:scale-[0.98] transition-all duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                J&apos;accepte et continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
