'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type UpdateItem = {
  id: string;
  title: string;
  completed_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  locale: string;
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function UpdatesModal({ open, onClose, locale }: Props) {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/app-suggestions?status=DONE')
      .then((res) => res.ok ? res.json() : { suggestions: [] })
      .then((data) => {
        const list = (data.suggestions ?? []).slice(0, 3);
        setItems(list);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Quoi de neuf sur REPUTEXA ?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400 py-4">
              Aucune nouveauté à afficher pour le moment.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((u) => (
                <li
                  key={u.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200/80 dark:border-zinc-800/50 bg-slate-50/50 dark:bg-zinc-800/30 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-zinc-100">
                      {u.title}
                    </p>
                    <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">
                      Disponible
                    </span>
                    {u.completed_at && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {formatDate(u.completed_at, locale)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-2 justify-end">
          <Link
            href="/dashboard/updates"
            className="text-sm font-medium text-primary hover:underline text-center"
            onClick={onClose}
          >
            Voir toutes les mises à jour
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-semibold text-white bg-primary hover:brightness-110 transition-all"
          >
            Super, j&apos;ai compris !
          </button>
        </div>
      </div>
    </div>
  );
}
