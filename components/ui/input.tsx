'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { uiFocusVisible } from '@/components/ui/focus-classes';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Champ texte de base — anneau `:focus-visible` pour navigation clavier.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 ${uiFocusVisible} ${className}`}
      {...props}
    />
  );
});
