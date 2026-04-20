import Link from 'next/link';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const headersList = await headers();
  const locale = headersList.get('x-next-intl-locale') ?? 'fr';
  const t = await getTranslations({ locale, namespace: 'Common.errorFallback' });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">{t('notFoundTitle')}</h1>
      <p className="text-slate-500 text-sm mb-4">{t('notFoundMessage')}</p>
      <Link
        href={`/${locale}`}
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:brightness-110 transition-colors"
      >
        {t('homeLink')}
      </Link>
    </div>
  );
}
