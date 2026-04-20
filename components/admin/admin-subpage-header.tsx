import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

type Props = {
  title: string;
  subtitle?: string;
  /** Court libellé discret (ex. module, outil) */
  badge?: string;
  icon?: ReactNode;
  backHref?: string;
  /** Libellé accessibilité du bouton retour (obligatoire — i18n) */
  backLabel: string;
  /** Boutons / liens à droite (export, etc.) */
  actions?: ReactNode;
  /** Largeur alignée sur les pages « document » (ex. kit audit) */
  narrow?: boolean;
};

/**
 * En-tête aligné sur tout le panneau admin : même grille, retour rond, hiérarchie lisible.
 */
export function AdminSubpageHeader({
  title,
  subtitle,
  badge,
  icon,
  backHref = '/dashboard/admin',
  backLabel,
  actions,
  narrow = false,
}: Props) {
  const max = narrow ? 'max-w-3xl' : 'max-w-6xl';
  return (
    <header className="border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/75">
      <div className={`mx-auto flex ${max} flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <Link
              href={backHref}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-900/40 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <div className="flex min-w-0 gap-3 sm:gap-3.5">
              {icon ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/90 bg-zinc-900/50 text-zinc-300 shadow-inner shadow-black/20">
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h1 className="text-[1.125rem] font-semibold leading-tight tracking-tight text-white sm:text-xl">
                    {title}
                  </h1>
                  {badge ? (
                    <span className="rounded-full border border-zinc-700/50 bg-zinc-900/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {badge}
                    </span>
                  ) : null}
                </div>
                {subtitle ? (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{subtitle}</p>
                ) : null}
              </div>
            </div>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
