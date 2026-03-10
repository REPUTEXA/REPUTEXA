'use client';

import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { CheckCircle2 } from 'lucide-react';
import { formatPrice } from '@/lib/format-price';

export default function ChoosePlanPage() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const noTrial = searchParams?.get('trial') === '0';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/40">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-slate-200/80 bg-white/70 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-2 text-slate-800" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading">REPUTEXA</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 font-medium">
          Mon dashboard
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl font-bold text-slate-900">
              Choisissez votre plan
            </h1>
            <p className="text-slate-500 mt-2">
              {noTrial
                ? "Paiement immédiat — Accès direct à votre dashboard"
                : "14 jours d'essai gratuit — Sans carte bancaire"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Link
              href={`/checkout?plan=vision${noTrial ? '&trial=0' : ''}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl hover:border-blue-200 transition-all"
            >
              <p className="font-display font-bold text-lg text-slate-900">{t('pricing.vision.name')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('pricing.vision.for')}</p>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                {formatPrice(locale, t('pricing.vision.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reponses')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reporting_vision')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_ia_tests')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_langues_vision')}
                </li>
              </ul>
              <span className="mt-6 block w-full py-2.5 rounded-xl bg-blue-600 text-white text-center font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-colors">
                {t('pricing.vision.cta')}
              </span>
            </Link>

            <Link
              href={`/checkout?plan=pulse${noTrial ? '&trial=0' : ''}`}
              className="flex flex-col rounded-2xl border-2 border-blue-500 bg-white p-6 shadow-lg hover:shadow-xl relative scale-105"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-full">
                {t('pricing.pulse.badge')}
              </span>
              <p className="font-display font-bold text-lg text-slate-900">{t('pricing.pulse.name')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('pricing.pulse.for')}</p>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                {formatPrice(locale, t('pricing.pulse.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reponses')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_alertes')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reporting_pulse')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_suppression')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_ia_tests')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_langues_autres')}
                </li>
              </ul>
              <span className="mt-6 block w-full py-2.5 rounded-xl bg-blue-600 text-white text-center font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-colors">
                {t('pricing.pulse.cta')}
              </span>
            </Link>

            <Link
              href={`/checkout?plan=zenith${noTrial ? '&trial=0' : ''}`}
              className="flex flex-col rounded-2xl border-2 border-blue-400 bg-white p-6 shadow-md hover:shadow-xl hover:border-blue-300 transition-all relative"
            >
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-blue-600 text-white rounded-full">
                {t('pricing.zenith.badge')}
              </span>
              <p className="font-display font-bold text-lg text-slate-900">{t('pricing.zenith.name')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{t('pricing.zenith.for')}</p>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                {formatPrice(locale, t('pricing.zenith.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reponses')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_triple')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_alertes')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_reporting_pulse')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_boost_seo')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_suppression')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_ai_capture')}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  {t('pricing.comparison.card_langues_autres')}
                </li>
              </ul>
              <span className="mt-6 block w-full py-2.5 rounded-xl bg-blue-600 text-white text-center font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-colors">
                {t('pricing.zenith.cta')}
              </span>
            </Link>
          </div>

          <p className="text-center mt-8">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
