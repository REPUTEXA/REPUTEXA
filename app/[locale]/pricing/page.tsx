'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { formatPrice } from '@/lib/format-price';
import { CheckCircle2, XCircle, Globe } from 'lucide-react';

type CellType = { type: 'check'; textKey: string } | { type: 'cross'; textKey?: string } | { type: 'globe'; textKey: string };

function renderCell(cell: CellType, tc: (k: string) => string) {
  if (cell.type === 'check') {
    return (
      <span className="flex flex-col items-center gap-1">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden />
        <span>{tc(cell.textKey)}</span>
      </span>
    );
  }
  if (cell.type === 'cross') {
    return (
      <span className="flex flex-col items-center gap-1">
        <XCircle className="w-5 h-5 text-red-500 shrink-0" aria-hidden />
        {cell.textKey && <span>{tc(cell.textKey)}</span>}
      </span>
    );
  }
  return (
    <span className="flex flex-col items-center gap-1">
      <Globe className="w-5 h-5 text-slate-500 shrink-0" aria-hidden />
      <span>{tc(cell.textKey)}</span>
    </span>
  );
}

const COMPARISON_ROWS: Array<{
  labelKey: string;
  vision: CellType;
  pulse: CellType;
  zenith: CellType;
}> = [
  { labelKey: 'reponses_avis', vision: { type: 'check', textKey: 'reponses_avis_val' }, pulse: { type: 'check', textKey: 'reponses_avis_val' }, zenith: { type: 'check', textKey: 'reponses_avis_val' } },
  { labelKey: 'triple_verification', vision: { type: 'cross', textKey: 'non' }, pulse: { type: 'cross', textKey: 'non' }, zenith: { type: 'check', textKey: 'triple_verification_val' } },
  { labelKey: 'alertes_mauvais', vision: { type: 'cross', textKey: 'non' }, pulse: { type: 'check', textKey: 'alertes_mauvais_val' }, zenith: { type: 'check', textKey: 'alertes_mauvais_val' } },
  { labelKey: 'reporting', vision: { type: 'check', textKey: 'reporting_vision' }, pulse: { type: 'check', textKey: 'reporting_pulse' }, zenith: { type: 'check', textKey: 'reporting_pulse' } },
  { labelKey: 'ia_tests_humains', vision: { type: 'check', textKey: 'ia_tests_val' }, pulse: { type: 'check', textKey: 'ia_tests_val' }, zenith: { type: 'check', textKey: 'ia_tests_val' } },
  { labelKey: 'boost_seo', vision: { type: 'cross', textKey: 'non' }, pulse: { type: 'cross', textKey: 'non' }, zenith: { type: 'check', textKey: 'boost_seo_val' } },
  { labelKey: 'suppression_haineux', vision: { type: 'cross', textKey: 'non' }, pulse: { type: 'check', textKey: 'suppression_val' }, zenith: { type: 'check', textKey: 'suppression_val' } },
  { labelKey: 'ai_capture', vision: { type: 'cross', textKey: 'non' }, pulse: { type: 'cross', textKey: 'non' }, zenith: { type: 'check', textKey: 'ai_capture_val' } },
  { labelKey: 'langues', vision: { type: 'globe', textKey: 'langues_vision' }, pulse: { type: 'globe', textKey: 'langues_autres' }, zenith: { type: 'globe', textKey: 'langues_autres' } },
];

export default function PricingPage() {
  const t = useTranslations('HomePage');
  const tc = useTranslations('HomePage.pricing.comparison');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const planRequired = searchParams?.get('error') === 'plan_required';

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white/95 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-800" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-lg">REPUTEXA</span>
          </Link>
          <Link
            href="/#tarifs"
            className="text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            Voir les offres
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {planRequired && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Un plan supérieur est requis pour accéder à cette fonctionnalité.
          </div>
        )}
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl font-bold text-slate-900 mb-2">
            Tableau comparatif
          </h1>
          <p className="text-slate-500">
            Tout ce qui est inclus dans chaque plan — transparent et sans surprise.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg">
          <table className="w-full min-w-[640px] border-collapse bg-white">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="text-left py-4 pl-6 pr-4 text-sm font-semibold text-slate-700">
                  Fonctionnalité
                </th>
                <th className="py-4 px-4 text-center text-sm font-semibold text-slate-900 w-[22%]">
                  <div>{t('pricing.vision.name')}</div>
                  <div className="text-base font-bold text-slate-700 mt-0.5">
                    {formatPrice(locale, t('pricing.vision.price'))}
                    <span className="text-xs font-normal text-slate-500">{t('perMonth')}</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center text-sm font-semibold text-slate-900 w-[22%] bg-blue-50/50">
                  <div>{t('pricing.pulse.name')}</div>
                  <div className="text-base font-bold text-blue-700 mt-0.5">
                    {formatPrice(locale, t('pricing.pulse.price'))}
                    <span className="text-xs font-normal text-slate-500">{t('perMonth')}</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center text-sm font-semibold text-slate-900 w-[22%]">
                  <div>{t('pricing.zenith.name')}</div>
                  <span className="inline-block text-[10px] font-bold text-slate-600 mt-1">{t('pricing.zenith.badge')}</span>
                  <div className="text-base font-bold text-slate-700 mt-0.5">
                    {formatPrice(locale, t('pricing.zenith.price'))}
                    <span className="text-xs font-normal text-slate-500">{t('perMonth')}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr
                  key={row.labelKey}
                  className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-slate-50/30' : ''}`}
                >
                  <td className="py-3.5 pl-6 pr-4 text-sm text-slate-700">
                    {tc(row.labelKey)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-sm text-slate-600">
                    {renderCell(row.vision, tc)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-sm text-slate-600 bg-blue-50/20">
                    {renderCell(row.pulse, tc)}
                  </td>
                  <td className="py-3.5 px-4 text-center text-sm text-slate-600">
                    {renderCell(row.zenith, tc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup?mode=checkout&plan=vision"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-colors"
          >
            Choisir Vision
          </Link>
          <Link
            href="/signup?mode=checkout&plan=pulse"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Choisir Pulse
          </Link>
          <Link
            href="/signup?mode=checkout&plan=zenith"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-blue-500 font-semibold text-blue-600 hover:bg-blue-50 active:scale-[0.98] transition-colors"
          >
            Choisir Zenith
          </Link>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          {t('pricingTrial')}
        </p>
      </main>
    </div>
  );
}
