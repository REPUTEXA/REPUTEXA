'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Lock } from 'lucide-react';

export function Paywall() {
  const t = useTranslations('Dashboard.paywall');

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">{t('title')}</h2>
        <p className="text-slate-600 mb-6">{t('body')}</p>
        <Link
          href="/upgrade"
          className="inline-block gradient-primary text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all"
        >
          {t('cta')}
        </Link>
      </div>
    </div>
  );
}
