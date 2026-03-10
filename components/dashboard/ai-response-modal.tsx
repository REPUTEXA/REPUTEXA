'use client';

import { useState, useEffect } from 'react';
import { X, Zap, Loader2, Check } from 'lucide-react';

type Props = {
  reviewId: string;
  reviewText: string;
  onClose: () => void;
  onResponded: () => void;
};

export function AIResponseModal({ reviewId, reviewText, onClose, onResponded }: Props) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchOptions() {
      try {
        setError(null);
        const res = await fetch(`/api/supabase/reviews/${reviewId}/generate-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erreur de génération');
        }
        const data = await res.json();
        if (!cancelled) setOptions(data.options ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOptions();
    return () => { cancelled = true; };
  }, [reviewId, reviewText]);

  const handleSelect = async (option: string) => {
    setSending(option);
    setError(null);
    try {
      const res = await fetch(`/api/supabase/reviews/${reviewId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText: option }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur d\'envoi');
      }
      onResponded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 dark:bg-black/80 backdrop-blur-xl" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[90vh] md:max-h-[85vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white dark:bg-[#0c0c0e] dark:backdrop-blur-xl shadow-xl dark:shadow-2xl border border-transparent dark:border-zinc-800/50 animate-bottom-sheet-in pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h3 className="font-display font-semibold text-slate-900 dark:text-zinc-100">
              Choisir une réponse IA
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-transform"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-10 w-10 text-sky-500 dark:text-indigo-400 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-zinc-400">Génération des options...</p>
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400 py-8 text-center">Aucune option disponible.</p>
          ) : (
            <div className="space-y-2">
              {options.map((opt, i) => {
                const label = String.fromCharCode(65 + i);
                const isSending = sending === opt;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    disabled={!!sending}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-zinc-800/50 hover:border-sky-300 dark:hover:border-indigo-500/50 hover:bg-sky-50/50 dark:hover:bg-white/5 active:scale-[0.99] transition-all disabled:opacity-70 min-h-[44px]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 dark:bg-indigo-500/20 text-sky-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                        {label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-zinc-100 leading-relaxed">{opt}</p>
                        {isSending && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-sky-600 dark:text-indigo-400">
                            <Loader2 className="h-3 w-3 animate-spin" /> Envoi...
                          </span>
                        )}
                        {!isSending && sending && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-slate-400 dark:text-zinc-500">
                            <Check className="h-3 w-3" /> Envoyé
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
