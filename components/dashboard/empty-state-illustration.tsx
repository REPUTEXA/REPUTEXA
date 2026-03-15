'use client';

import { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  action: ReactNode;
  className?: string;
};

/** Illustration SVG minimaliste pour empty state (établissement / avis) */
function IllustrationSvg() {
  return (
    <svg
      width="200"
      height="140"
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto text-slate-300 dark:text-slate-600"
      aria-hidden
    >
      <rect x="40" y="50" width="120" height="70" rx="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="75" r="12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M70 95 h60" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M70 105 h40" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      <path d="M30 90 L50 70 L70 85 L90 55 L110 75 L130 60 L150 80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5" />
    </svg>
  );
}

export function EmptyStateIllustration({ title, description, action, className = '' }: Props) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-8 sm:p-10 text-center ${className}`}>
      <div className="mb-6">
        <IllustrationSvg />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">{description}</p>}
      <div className="flex justify-center">{action}</div>
    </div>
  );
}
