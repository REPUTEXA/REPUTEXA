'use client';

import { Check } from 'lucide-react';

type Update = {
  id: string;
  title: string;
  completedAt: string;
};

type Props = {
  updates: Update[];
  locale: string;
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function UpdatesList({ updates, locale }: Props) {
  if (updates.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Aucune mise à jour pour le moment. Les suggestions marquées « Terminé » apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {updates.map((u) => (
        <li
          key={u.id}
          className="rounded-xl border border-slate-200/80 dark:border-zinc-800/50 bg-white dark:bg-[#09090b] p-4 sm:p-5 shadow-[2px_2px_0_rgba(0,0,0,0.03)] dark:shadow-[2px_2px_0_rgba(0,0,0,0.2)] transition-colors hover:border-slate-300/80 dark:hover:border-zinc-700/50"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Check className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 dark:text-zinc-100">
                Mise à jour : {u.title} est maintenant disponible !
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                {formatDate(u.completedAt, locale)}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
