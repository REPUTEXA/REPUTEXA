import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';

export type TocItem = { id: string; label: string };

export type LegalNavLink = { href: string; label: string };

type LegalPageShellProps = {
  title: string;
  toc: TocItem[];
  children: React.ReactNode;
  navLinks?: LegalNavLink[];
  tocLabel?: string;
};

const DEFAULT_NAV: LegalNavLink[] = [
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/confidentialite', label: 'Confidentialité' },
  { href: '/legal/cgu', label: 'CGU' },
  { href: '/contact', label: 'Contact' },
];

export function LegalPageShell({ title, toc, children, navLinks = DEFAULT_NAV, tocLabel = 'Table des matières' }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-800 dark:text-slate-100" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg uppercase">REPUTEXA</span>
          </Link>
          <nav className="flex items-center gap-4" aria-label="Legal">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">
          <aside
            className="lg:w-64 shrink-0"
            aria-label={tocLabel}
          >
            <nav
              className="sticky top-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                {tocLabel}
              </p>
              <ul className="space-y-1.5">
                {toc.map(({ id, label }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] hover:underline underline-offset-2 transition-colors block py-0.5"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="flex-1 min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-6">
              {title}
            </h1>
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-display prose-a:text-[#2563eb] prose-a:no-underline hover:prose-a:underline">
              {children}
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-700 dark:text-slate-200" aria-label="REPUTEXA">
            <Logo size="sm" />
            <span className="font-display font-bold uppercase">REPUTEXA</span>
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} REPUTEXA. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
