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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="font-display font-semibold text-slate-900">
              Choisir une réponse IA
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-10 w-10 text-sky-500 animate-spin" />
              <p className="text-sm text-slate-600">Génération des options...</p>
            </div>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Aucune option disponible.</p>
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
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all disabled:opacity-70"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-600 text-xs font-bold flex items-center justify-center">
                        {label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 leading-relaxed">{opt}</p>
                        {isSending && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-sky-600">
                            <Loader2 className="h-3 w-3 animate-spin" /> Envoi...
                          </span>
                        )}
                        {!isSending && sending && (
                          <span className="inline-flex items-center gap-1 mt-2 text-xs text-slate-400">
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
