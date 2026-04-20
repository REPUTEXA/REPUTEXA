import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type Publisher = {
  name: string;
  legalForm: string;
  address: string;
  registration: string;
  siret: string;
  shareCapital: string;
  director: string;
  dpoEmail: string;
  hosting: string;
};

function lineOrPlaceholder(value: string, placeholder: string): string {
  const t = value.trim();
  return t || placeholder;
}

export async function ImpressumDePageBody({ publisher }: { publisher: Publisher }) {
  const t = await getTranslations('Legal.impressum');
  const ph = `[${t('placeholderShort')}]`;

  return (
    <div className="legal-doc-body prose prose-slate dark:prose-invert max-w-none">
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed not-prose mb-8">
        {t('intro')}
      </p>
      <p className="text-xs text-amber-800/90 dark:text-amber-200/80 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-lg px-3 py-2 not-prose mb-8">
        {t('placeholderHint')}
      </p>

      <h2 id="anbieter" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('providerHeading')}
      </h2>
      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">
        {lineOrPlaceholder(publisher.name, ph)}
        {publisher.legalForm ? `\n${publisher.legalForm}` : ''}
        {publisher.address ? `\n${publisher.address}` : `\n${ph}`}
      </p>

      <h2 id="kontakt" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('contactHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300">
        {lineOrPlaceholder(publisher.dpoEmail, ph)}
      </p>

      <h2 id="register" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('registerHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
        {lineOrPlaceholder(publisher.registration, ph)}
        {publisher.siret ? `\n${t('registerSiretFrLine', { siret: publisher.siret })}` : ''}
        {publisher.shareCapital ? `\n${publisher.shareCapital}` : ''}
      </p>

      <h2 id="vertretung" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('representationHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300">{lineOrPlaceholder(publisher.director, ph)}</p>

      <h2 id="datenschutz" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('supervisoryHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300">
        {t.rich('privacyNoticeRich', {
          privacy: (chunks) => (
            <Link href="/legal/confidentialite" className="text-[#2563eb] hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <h2 id="hosting" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('hostingHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
        {lineOrPlaceholder(publisher.hosting, ph)}
      </p>

      <h2 id="streit" className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-10">
        {t('disputeHeading')}
      </h2>
      <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">{t('disputeBody')}</p>

      <p className="text-slate-500 dark:text-slate-500 text-xs mt-12 leading-relaxed border-t border-slate-200 dark:border-slate-800 pt-6">
        {t('liabilityNote')}
      </p>
    </div>
  );
}
