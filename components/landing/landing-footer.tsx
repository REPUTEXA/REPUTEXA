'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { FooterLocaleSelector } from '@/components/footer-locale-selector';

/** Apple-style link: opacity transition 0.3s, active scale 0.98 */
const linkClass =
  'text-xs text-gray-400 hover:text-white transition-opacity duration-300 active:scale-[0.98] inline-block';

export function LandingFooter() {
  const t = useTranslations('LandingFooter');
  const locale = useLocale();
  const year = new Date().getFullYear();

  const columns: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: t('colResources'),
      links: [
        { label: t('linkDocumentation'), href: '/documentation' },
        { label: t('linkBlog'), href: '/blog' },
        { label: t('linkGuides'), href: '/guides' },
        { label: t('linkApi'), href: '/api' },
        { label: t('linkStatuts'), href: '/statuts' },
      ],
    },
    {
      heading: t('colHelp'),
      links: [
        { label: t('linkHelpCenter'), href: '/help' },
        { label: t('linkContact'), href: '/contact' },
        { label: t('linkReportIssue'), href: '/report-issue' },
        { label: t('linkDataRights'), href: '/data-rights/client' },
        { label: t('linkSecurity'), href: '/security' },
      ],
    },
    {
      heading: t('colCompany'),
      links: [
        { label: t('linkAbout'), href: '/about' },
        { label: t('linkNews'), href: '/news' },
        { label: t('linkCareers'), href: '/careers' },
        { label: t('linkInvestors'), href: '/investors' },
        { label: t('linkSustainability'), href: '/sustainability' },
      ],
    },
    {
      heading: t('colProduct'),
      links: [
        { label: t('linkPricing'), href: '/pricing' },
        { label: t('linkFeatures'), href: '/features' },
        { label: t('linkTestimonials'), href: '/testimonials' },
        { label: t('linkFreeTrial'), href: '/free-trial' },
        { label: t('linkLogin'), href: '/login' },
      ],
    },
  ];

  const legalLinks = [
    { label: t('legalMentions'), href: '/legal/mentions-legales' },
    { label: t('legalPrivacy'), href: '/legal/confidentialite' },
    { label: t('legalTerms'), href: '/legal/cgu' },
    { label: t('legalCookies'), href: '/legal/confidentialite#cookies' },
    { label: t('linkSitemap'), href: '/sitemap' },
  ];

  return (
    <footer className="bg-navy border-t border-white/[0.06] font-sans tracking-[0.02em]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10 lg:gap-8">
          <div className="flex flex-col gap-5">
            <Link
              href="/"
              aria-label={t('ariaBrand')}
              className="flex items-center gap-2 w-fit transition-opacity duration-300 hover:opacity-90 active:scale-[0.98]"
            >
              <Logo size="sm" />
              <span className="font-display font-bold text-white tracking-[0.025em] uppercase text-sm">
                REPUTEXA
              </span>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[240px]">{t('tagline')}</p>
            {locale === 'de' ? (
              <p className="text-xs">
                <Link
                  href="/impressum"
                  className="font-semibold text-gray-300 hover:text-white underline underline-offset-2 transition-colors"
                >
                  {t('impressumLink')}
                </Link>
                <span className="text-gray-400"> — {t('impressumDeHint')}</span>
              </p>
            ) : null}
            <FooterLocaleSelector />
          </div>

          {columns.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-white uppercase tracking-[0.15em]">{col.heading}</p>
              <ul className="flex flex-col gap-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500 order-2 sm:order-1 font-sans tracking-[0.02em]">
            {t('copyright', { year })}
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 order-1 sm:order-2"
            aria-label={t('legalNavAria')}
          >
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className={`${linkClass} text-gray-400`}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
