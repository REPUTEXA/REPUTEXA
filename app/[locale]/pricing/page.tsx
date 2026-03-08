'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { formatPrice } from '@/lib/format-price';
import { Check, X } from 'lucide-react';

const COMPARISON_ROWS: Array<{ key: string; vision: boolean; pulse: boolean; zenith: boolean }> = [
  { key: 'comparison.ai_local', vision: true, pulse: true, zenith: true },
  { key: 'comparison.ai_all_languages', vision: false, pulse: true, zenith: true },
  { key: 'comparison.reporting_pdf', vision: true, pulse: true, zenith: true },
  { key: 'comparison.triple_verification', vision: false, pulse: true, zenith: true },
  { key: 'comparison.whatsapp_alerts', vision: false, pulse: true, zenith: true },
  { key: 'comparison.reporting_whatsapp_recap', vision: false, pulse: true, zenith: true },
  { key: 'comparison.shield_alert', vision: false, pulse: true, zenith: true },
  { key: 'comparison.ai_capture', vision: false, pulse: false, zenith: true },
  { key: 'comparison.pos_connector', vision: false, pulse: false, zenith: true },
];

export default function PricingPage() {
  const t = useTranslations('HomePage');
  const tc = useTranslations('HomePage.pricing.comparison');
  const locale = useLocale();

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
                  key={row.key}
                  className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-slate-50/30' : ''}`}
                >
                  <td className="py-3.5 pl-6 pr-4 text-sm text-slate-700">
                    {tc(row.key)}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {row.vision ? (
                      <Check className="w-5 h-5 text-[#2563eb] mx-auto" aria-hidden />
                    ) : (
                      <X className="w-5 h-5 text-slate-300 mx-auto" aria-hidden />
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center bg-blue-50/20">
                    {row.pulse ? (
                      <Check className="w-5 h-5 text-[#2563eb] mx-auto" aria-hidden />
                    ) : (
                      <X className="w-5 h-5 text-slate-300 mx-auto" aria-hidden />
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {row.zenith ? (
                      <Check className="w-5 h-5 text-[#2563eb] mx-auto" aria-hidden />
                    ) : (
                      <X className="w-5 h-5 text-slate-300 mx-auto" aria-hidden />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup?mode=checkout&plan=vision"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
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
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-blue-500 font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
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
