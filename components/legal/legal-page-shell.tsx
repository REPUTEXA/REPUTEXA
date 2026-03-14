import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';

export type TocItem = { id: string; label: string };

type LegalPageShellProps = {
  title: string;
  toc: TocItem[];
  children: React.ReactNode;
};

export function LegalPageShell({ title, toc, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-800 dark:text-slate-100" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg">REPUTEXA</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/legal"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              Mentions légales
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              Confidentialité
            </Link>
            <Link
              href="/terms"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              CGV
            </Link>
            <Link
              href="/contact"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] font-medium transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">
          <aside
            className="lg:w-64 shrink-0"
            aria-label="Table des matières"
          >
            <nav
              className="sticky top-24 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Table des matières
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
            <span className="font-display font-bold">REPUTEXA</span>
          </Link>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} REPUTEXA. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
