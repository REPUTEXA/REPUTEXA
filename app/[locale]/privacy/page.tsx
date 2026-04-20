import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

type Props = { params: Promise<{ locale: string }> };

const TOC_IDS = [
  'editeur',
  'donnees-collectees',
  'finalites',
  'avis-google',
  'ia',
  'paiements-stripe',
  'sous-traitants',
  'cookies',
  'duree-conservation',
  'droits',
  'securite',
  'modifications',
  'contact',
] as const;

function stripePrivacyHref(locale: string): string {
  if (locale === 'fr') return 'https://stripe.com/fr/privacy';
  if (locale === 'de') return 'https://stripe.com/de/privacy';
  return 'https://stripe.com/privacy';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PublicPages.privacyRoute' });
  const baseUrl = 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/privacy' : `/${locale}/privacy`;
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

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('PublicPages.privacyRoute');
  const stripeHref = stripePrivacyHref(locale);

  const bold = { b: (chunks: ReactNode) => <strong>{chunks}</strong> };

  const toc = TOC_IDS.map((id, i) => ({
    id,
    label: t(`toc${i + 1}`),
  }));

  return (
    <LegalPageShell title={t('pageTitle')} toc={toc}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">{t('intro')}</p>

      <section id="editeur" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc1')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t.rich('s1_p1', bold)}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('s1_p2')}</p>
      </section>

      <section id="donnees-collectees" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc2')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('s2_intro')}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2">
          <li>{t.rich('s2_li1', bold)}</li>
          <li>{t.rich('s2_li2', bold)}</li>
          <li>{t.rich('s2_li3', bold)}</li>
          <li>{t.rich('s2_li4', bold)}</li>
          <li>{t.rich('s2_li5', bold)}</li>
        </ul>
      </section>

      <section id="finalites" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc3')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('s3_intro')}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2">
          <li>{t.rich('s3_li1', bold)}</li>
          <li>{t.rich('s3_li2', bold)}</li>
          <li>{t.rich('s3_li3', bold)}</li>
          <li>{t.rich('s3_li4', bold)}</li>
        </ul>
      </section>

      <section id="avis-google" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc4')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('s4_p1')}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.rich('s4_p2', bold)}</p>
      </section>

      <section id="ia" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc5')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('s5_p1')}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.rich('s5_p2', bold)}</p>
      </section>

      <section id="paiements-stripe" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc6')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('s6_body', {
            strong: (chunks) => <strong>{chunks}</strong>,
            stripeLink: (chunks) => (
              <a
                href={stripeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563eb] hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>

      <section id="sous-traitants" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc7')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('s7_intro')}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>{t.rich('s7_li1', bold)}</li>
          <li>{t.rich('s7_li2', bold)}</li>
          <li>{t.rich('s7_li3', bold)}</li>
          <li>{t.rich('s7_li4', bold)}</li>
          <li>{t.rich('s7_li5', bold)}</li>
          <li>{t.rich('s7_li6', bold)}</li>
          <li>{t.rich('s7_li7', bold)}</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('s7_footer')}</p>
      </section>

      <section id="cookies" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc8')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t.rich('s8_p1', bold)}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>{t.rich('s8_li1', bold)}</li>
          <li>{t.rich('s8_li2', bold)}</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('s8_p2')}</p>
      </section>

      <section id="duree-conservation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc9')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('s9_p1')}</p>
      </section>

      <section id="droits" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc10')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('s10_intro')}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>{t.rich('s10_li1', bold)}</li>
          <li>{t.rich('s10_li2', bold)}</li>
          <li>{t.rich('s10_li3', bold)}</li>
          <li>{t.rich('s10_li4', bold)}</li>
          <li>{t.rich('s10_li5', bold)}</li>
        </ul>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('s10_rights', {
            contactLink: (chunks) => (
              <Link href="/contact" className="text-[#2563eb] hover:underline">
                {chunks}
              </Link>
            ),
            cnilLink: (chunks) => (
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563eb] hover:underline"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>

      <section id="securite" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc11')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('s11_p1')}</p>
      </section>

      <section id="modifications" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc12')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('s12_p1')}</p>
      </section>

      <section id="contact" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('toc13')}</h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('s13_body', {
            contactLink: (chunks) => (
              <Link href="/contact" className="text-[#2563eb] hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </section>
    </LegalPageShell>
  );
}
