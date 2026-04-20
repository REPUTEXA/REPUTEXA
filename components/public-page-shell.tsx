'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function PublicPageShell({ title, subtitle, children }: Props) {
  const t = useTranslations('PublicPageShell');
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-navy page-spotlight page-film-grain">
      <header className="border-b border-white/10 bg-navy/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity"
            aria-label={t('ariaBrand')}
          >
            <Logo size="sm" />
            <span className="font-display font-bold text-sm uppercase tracking-wider">REPUTEXA</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-5" aria-label={t('navAria')}>
            <Link href="/features" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navFeatures')}
            </Link>
            <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navPricing')}
            </Link>
            <Link href="/blog" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navBlog')}
            </Link>
            <Link href="/help" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navHelp')}
            </Link>
            <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navLogin')}
            </Link>
            <Link
              href="/free-trial"
              className="text-sm font-semibold text-white px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
            >
              {t('navFreeTrial')}
            </Link>
          </nav>
          <div className="sm:hidden flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
              {t('navLogin')}
            </Link>
            <Link
              href="/free-trial"
              className="text-sm font-semibold text-white px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors"
            >
              {t('navTrialShort')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 relative z-10">
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">{title}</h1>
          {subtitle && <p className="text-gray-400 text-sm max-w-2xl mx-auto">{subtitle}</p>}
        </div>
        {children}
      </main>

      <footer className="border-t border-white/10 py-6 mt-12 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-opacity">
            <Logo size="sm" />
            <span className="font-display font-bold text-xs uppercase">REPUTEXA</span>
          </Link>
          <p className="text-xs text-gray-500">{t('copyright', { year })}</p>
        </div>
      </footer>
    </div>
  );
}
