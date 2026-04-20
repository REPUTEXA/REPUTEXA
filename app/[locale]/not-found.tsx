'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('Common.errorFallback');
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="font-display text-2xl font-bold text-slate-900 mb-2">{t('notFoundTitle')}</h1>
      <p className="text-slate-500 text-sm mb-4">{t('notFoundMessage')}</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-primary text-white font-medium hover:brightness-110 transition-colors"
      >
        {t('homeLink')}
      </Link>
    </div>
  );
}
