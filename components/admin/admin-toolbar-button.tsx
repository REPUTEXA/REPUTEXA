import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'secondary' | 'primary' | 'quiet';

const variants: Record<Variant, string> = {
  secondary:
    'border border-zinc-700/70 bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-600 focus-visible:ring-zinc-500/35',
  primary:
    'border border-sky-500/35 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15 hover:border-sky-400/45 focus-visible:ring-sky-500/35',
  quiet: 'border border-transparent text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 focus-visible:ring-zinc-500/35',
};

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/** Bouton compact pour barres d’outils admin — focus anneau cohérent. */
export function AdminToolbarButton({
  children,
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
