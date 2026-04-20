import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LegalPageShell } from '@/components/legal/legal-page-shell';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Legal.terms' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://reputexa.fr';
  const path = locale === 'fr' ? '/fr/terms' : `/${locale}/terms`;
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

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Legal.terms' });
  const tNav = await getTranslations({ locale, namespace: 'Legal.nav' });
  const tocRaw = t.raw('toc') as Array<{ id: string; label: string }>;
  const toc = Array.isArray(tocRaw) ? tocRaw : [];

  return (
    <LegalPageShell title={t('title')} toc={toc} tocLabel={tNav('toc')}>
      <p className="text-slate-600 dark:text-slate-400 mb-8">{t('intro')}</p>

      <section id="objet" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('objet_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('objet_content')}</p>
      </section>

      <section id="services" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('services_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('services_lead', {
            vision: (chunks) => <strong>{chunks}</strong>,
            pulse: (chunks) => <strong>{chunks}</strong>,
            zenith: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('services_2_1_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('services_2_1_p1')}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('services_2_1_resp', {
            resp: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('services_2_1_edit', {
            edit: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('services_2_1_neg', {
            neg: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('services_2_2_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('services_2_2_p1', {
            sug: (chunks) => <strong>{chunks}</strong>,
            validate: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('services_2_3_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('services_2_3_p1', {
            wa: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('services_2_4_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('services_2_4_p1', {
            third: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </section>

      <section id="inscription" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('inscription_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('inscription_p1')}</p>
      </section>

      <section id="abonnement" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('abonnement_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('abonnement_p1', {
            rec: (chunks) => <strong>{chunks}</strong>,
            stripe: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>{t('abonnement_li1')}</li>
          <li>
            {t.rich('abonnement_li2', {
              due: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>{t('abonnement_li3')}</li>
          <li>{t('abonnement_li4')}</li>
        </ul>
      </section>

      <section id="multi-etablissements" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('multi_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('multi_p1', {
            policy: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('multi_h4_prorata')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('multi_prorata_intro')}</p>
        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400 ml-2 mb-3">
          <li>
            {t.rich('multi_prorata_li1', {
              pr: (chunks) => <strong>{chunks}</strong>,
            })}
          </li>
          <li>{t('multi_prorata_li2')}</li>
          <li>{t('multi_prorata_li3')}</li>
        </ul>
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('multi_h4_downgrade')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('multi_downgrade_p1', {
            stripe: (chunks) => <strong>{chunks}</strong>,
            credit: (chunks) => <strong>{chunks}</strong>,
            kept: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </section>

      <section id="retractation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('retract_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('retract_p1')}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('retract_p2', {
            waive: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('retract_contact', {
            link: (chunks) => (
              <a href="/contact" className="text-[#2563eb] hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>

      <section id="resiliation" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('resiliation_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('resiliation_p1')}</p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('resiliation_p2')}</p>
      </section>

      <section id="responsabilite" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('liability_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{t('liability_intro')}</p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('liability_81_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">{t('liability_81_p1')}</p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('liability_82_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('liability_82_p1', {
            sug: (chunks) => <strong>{chunks}</strong>,
            edit: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('liability_83_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('liability_83_p1', {
            mod: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>

        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-2">
          {t('liability_84_title')}
        </h4>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('liability_84_p1')}</p>
      </section>

      <section id="force-majeure" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('fm_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          {t.rich('fm_p1', {
            fm: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('fm_p2', {
            divis: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
      </section>

      <section id="ip" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('ip_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('ip_p1')}</p>
      </section>

      <section id="modifications" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('cgvchg_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('cgvchg_p1')}</p>
      </section>

      <section id="droit" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('law_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-2">
          {t.rich('law_p1', {
            law: (chunks) => <strong>{chunks}</strong>,
            court: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t('law_p2')}</p>
      </section>

      <section id="contact" className="mb-10">
        <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
          {t('cgv_contact_title')}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.rich('cgv_contact_p', {
            link: (chunks) => (
              <a href="/contact" className="text-[#2563eb] hover:underline">
                {chunks}
              </a>
            ),
          })}
        </p>
      </section>
    </LegalPageShell>
  );
}
