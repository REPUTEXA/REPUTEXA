import { getTranslations } from 'next-intl/server';

/**
 * Rendu du HTML publié en admin (source de vérité post–jour J).
 * Contenu trusté (écriture service_role uniquement sur legal_versioning).
 */
export async function LegalPublishedHtml({
  html,
  version,
  effectiveDateLabel,
  locale,
}: {
  html: string;
  version: number;
  effectiveDateLabel: string;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: 'Legal.publishedWrapper' });
  return (
    <>
      <p className="legal-doc-intro text-slate-600 dark:text-slate-400 mb-10 border-b border-slate-200/90 dark:border-slate-800/90 pb-8">
        {t('effectiveLead')}{' '}
        <strong className="text-slate-800 dark:text-slate-200">{effectiveDateLabel}</strong>{' '}
        <span className="text-slate-500 dark:text-slate-500">{t('versionParen', { version })}</span>.
      </p>
      <div
        className="legal-published-html max-w-none text-slate-600 dark:text-slate-400 legal-doc-section-inner [&_a]:text-[#2563eb] [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-[3px] [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-slate-900 [&_h1]:dark:text-slate-50 [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:dark:text-slate-50 [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:dark:text-slate-50 [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_li]:mb-1 [&_strong]:text-slate-800 [&_strong]:dark:text-slate-200"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
