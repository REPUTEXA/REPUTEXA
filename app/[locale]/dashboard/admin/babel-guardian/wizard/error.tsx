'use client';

import { useTranslations } from 'next-intl';

/** Boundary dédiée : même si une erreur remonte avant le rendu parent, `NextIntlClientProvider` enveloppe `[locale]`. */
export default function BabelWizardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Dashboard.adminBabelWizard');
  const message = error.message?.trim() || t('errorFallbackMessage');

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-center text-white">
      <p className="max-w-md text-sm text-zinc-400">{message}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[10px] text-zinc-600">ref {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-zinc-950 hover:opacity-90"
      >
        {t('errorRetry')}
      </button>
    </div>
  );
}
