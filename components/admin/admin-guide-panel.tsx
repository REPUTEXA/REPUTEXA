'use client';

import { BookOpen, ChevronDown } from 'lucide-react';

type Props = {
  title: string;
  children: React.ReactNode;
  /** Variante discrète sous une carte */
  variant?: 'default' | 'compact';
};

export function AdminGuidePanel({ title, children, variant = 'default' }: Props) {
  const box =
    variant === 'compact'
      ? 'rounded-xl border border-zinc-800/60 bg-zinc-900/25'
      : 'rounded-2xl border border-zinc-800/70 bg-zinc-900/20';

  return (
    <details
      className={`group ${box} text-sm text-zinc-300 open:border-zinc-700/80 open:bg-zinc-900/30`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[inherit] px-4 py-3.5 font-medium text-zinc-200 transition-colors hover:bg-zinc-800/20 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-600/50">
        <span className="flex min-w-0 items-center gap-2.5">
          <BookOpen className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
          <span className="truncate">{title}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600 transition-transform group-open:rotate-180" strokeWidth={2} />
      </summary>
      <div className="space-y-3 border-t border-zinc-800/60 px-4 pb-4 pt-3 text-xs leading-relaxed text-zinc-500">
        {children}
      </div>
    </details>
  );
}
