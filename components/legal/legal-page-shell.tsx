'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';

export type TocItem = { id: string; label: string };

export type LegalNavLink = { href: string; label: string };

type LegalPageShellProps = {
  title: string;
  toc: TocItem[];
  children: React.ReactNode;
  /** Si omis, navigation standard (mentions, confidentialité, CGU, cookies, plan du site, contact). */
  navLinks?: LegalNavLink[];
  tocLabel?: string;
};

export function LegalPageShell({ title, toc, children, navLinks, tocLabel }: LegalPageShellProps) {
  const tNav = useTranslations('Legal.nav');
  const tFooter = useTranslations('Footer');
  const tShell = useTranslations('Legal.shell');

  const defaultNav: LegalNavLink[] = [
    { href: '/legal/mentions-legales', label: tNav('mentions') },
    { href: '/impressum', label: tFooter('impressum') },
    { href: '/legal/confidentialite', label: tNav('privacy') },
    { href: '/legal/cgu', label: tNav('terms') },
    { href: '/legal/confidentialite#cookies', label: tNav('cookies') },
    { href: '/sitemap', label: tNav('sitemap') },
    { href: '/contact', label: tNav('contact') },
  ];

  const links = navLinks ?? defaultNav;
  const tocHeading = tocLabel ?? tNav('toc');

  return (
    <div className="legal-docs-root min-h-screen bg-[#fafafa] dark:bg-slate-950 page-spotlight page-film-grain">
      <header className="sticky top-0 z-20 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl backdrop-saturate-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 group shrink-0"
            aria-label={tShell('ariaBrand')}
          >
            <Logo />
            <span className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-50">
              REPUTEXA
            </span>
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1 sm:gap-x-3 sm:gap-y-0 max-w-[min(100%,42rem)] justify-end"
            aria-label={tShell('ariaMainNavLegal')}
          >
            {links.map(({ href, label }, i) => (
              <Link
                key={`${href}-${i}`}
                href={href}
                className="text-[12px] sm:text-[13px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors whitespace-nowrap"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          {toc.length > 0 && (
            <aside className="lg:w-[17.5rem] shrink-0" aria-label={tocHeading}>
              <nav className="lg:sticky lg:top-24 rounded-2xl bg-white/90 dark:bg-slate-900/90 p-4 shadow-soft ring-1 ring-black/[0.05] dark:ring-white/[0.07]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mb-3 px-1">
                  {tocHeading}
                </p>
                <ul className="space-y-0.5">
                  {toc.map(({ id, label }) => (
                    <li key={id}>
                      <a
                        href={`#${id}`}
                        className="text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 leading-snug block py-2 px-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          )}

          <article className="flex-1 min-w-0">
            <h1 className="text-[1.75rem] sm:text-[2.125rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50 mb-8 sm:mb-10 leading-[1.15]">
              {title}
            </h1>
            <div className="max-w-none legal-doc-body">{children}</div>
          </article>
        </div>
      </main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-slate-900/40 py-8 mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-300"
            aria-label={tShell('ariaBrand')}
          >
            <Logo size="sm" />
            <span className="font-semibold text-sm tracking-tight">REPUTEXA</span>
          </Link>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
            <a
              href="/docs/registre-rgpd-reputexa.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {tShell('footerRegisterArt30')}
            </a>
            <p className="text-[12px] text-slate-400 dark:text-slate-500">
              © {new Date().getFullYear()} REPUTEXA
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
