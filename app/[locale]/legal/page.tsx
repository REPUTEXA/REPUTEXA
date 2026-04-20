import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.hub' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/legal' : `/${locale}/legal`;
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: `${baseUrl}${path}` },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: `${baseUrl}${path}`,
      siteName: 'REPUTEXA',
    },
  };
}

type HubCard = { href: string; titleKey: 'cardMentionsTitle' | 'cardPrivacyTitle' | 'cardTermsTitle' | 'cardCookiesTitle' | 'cardSitemapTitle'; descKey: 'cardMentionsDesc' | 'cardPrivacyDesc' | 'cardTermsDesc' | 'cardCookiesDesc' | 'cardSitemapDesc' };

const HUB_CARDS: HubCard[] = [
  { href: '/legal/mentions-legales', titleKey: 'cardMentionsTitle', descKey: 'cardMentionsDesc' },
  { href: '/legal/confidentialite', titleKey: 'cardPrivacyTitle', descKey: 'cardPrivacyDesc' },
  { href: '/legal/cgu', titleKey: 'cardTermsTitle', descKey: 'cardTermsDesc' },
  { href: '/legal/confidentialite#cookies', titleKey: 'cardCookiesTitle', descKey: 'cardCookiesDesc' },
  { href: '/sitemap', titleKey: 'cardSitemapTitle', descKey: 'cardSitemapDesc' },
];

export default async function LegalHubPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.hub' });

  return (
    <LegalPageShell title={t('title')} toc={[]}>
      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-10 max-w-3xl">{t('intro')}</p>
      <ul className="grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
        {HUB_CARDS.map(({ href, titleKey, descKey }) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-slate-900/60 p-6 shadow-sm hover:border-[#2563eb]/40 hover:bg-slate-50/90 dark:hover:bg-white/[0.04] transition-colors h-full"
            >
              <span className="font-display font-semibold text-slate-900 dark:text-slate-100 text-base block mb-2">
                {t(titleKey)}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{t(descKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </LegalPageShell>
  );
}
