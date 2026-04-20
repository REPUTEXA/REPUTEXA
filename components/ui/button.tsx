'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { uiFocusVisible } from '@/components/ui/focus-classes';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Bouton de base dashboard — inclut un état `:focus-visible` avec anneau visible.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${uiFocusVisible} ${className}`}
      {...props}
    />
  );
});
