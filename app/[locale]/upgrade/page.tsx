'use client';

import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { Check, Lock } from 'lucide-react';
import { formatPrice } from '@/lib/format-price';

export default function UpgradePage() {
  const t = useTranslations('HomePage');
  const locale = useLocale();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
      <header className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 text-white" aria-label="REPUTEXA">
          <Logo />
          <span className="font-display font-bold text-lg tracking-heading">REPUTEXA</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-white/70 hover:text-white font-medium">
          Retour au dashboard
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
              <Lock className="w-7 h-7 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Choisissez votre plan
              </h1>
              <p className="text-white/60 text-sm mt-0.5">
                14 jours gratuits avec carte · Annulation en un clic
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 hover:border-[#2563eb]/50 transition-all duration-300">
              <p className="font-display font-bold text-lg text-white">{t('pricing.vision.name')}</p>
              <p className="text-xs text-white/50 mt-0.5">{t('pricing.vision.for')}</p>
              <p className="mt-4 text-2xl font-bold text-white">
                {formatPrice(locale, t('pricing.vision.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.ai_local')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.reporting_pdf')}
                </li>
              </ul>
              <Link
                href={`/checkout?plan=vision`}
                className="mt-6 block w-full py-2.5 rounded-xl bg-primary text-white text-center font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-colors"
              >
                S&apos;abonner
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl border-2 border-[#2563eb] bg-[#2563eb]/10 backdrop-blur-sm p-6 relative scale-105 shadow-glow">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-primary text-white rounded-full">
                Recommandé
              </span>
              <p className="font-display font-bold text-lg text-white">{t('pricing.pulse.name')}</p>
              <p className="text-xs text-white/60 mt-0.5">{t('pricing.pulse.for')}</p>
              <p className="mt-4 text-2xl font-bold text-white">
                {formatPrice(locale, t('pricing.pulse.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-white/90">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.ai_local')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/90">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.ai_all_languages')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/90">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.whatsapp_alerts')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/90">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {t('pricing.comparison.shield_alert')}
                </li>
              </ul>
              <Link
                href={`/checkout?plan=pulse`}
                className="mt-6 block w-full py-2.5 rounded-xl bg-white text-primary text-center font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-colors"
              >
                S&apos;abonner
              </Link>
            </div>

            <div className="flex flex-col rounded-2xl border-2 border-[#2563eb]/40 bg-white/5 backdrop-blur-sm p-6 hover:border-[#2563eb] transition-all duration-300">
              <p className="font-display font-bold text-lg text-white">{t('pricing.zenith.name')}</p>
              <p className="text-xs text-white/50 mt-0.5">{t('pricing.zenith.for')}</p>
              <p className="mt-4 text-2xl font-bold text-white">
                {formatPrice(locale, t('pricing.zenith.price'))}
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-[#2563eb] shrink-0" />
                  {t('pricing.comparison.card_consultant')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-[#2563eb] shrink-0" />
                  {t('pricing.comparison.ai_capture')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-[#2563eb] shrink-0" />
                  {t('pricing.comparison.pos_connector')}
                </li>
                <li className="flex items-center gap-2 text-sm text-white/80">
                  <Check className="w-4 h-4 text-[#2563eb] shrink-0" />
                  {t('pricing.comparison.shield_alert')}
                </li>
              </ul>
              <Link
                href={`/checkout?plan=zenith`}
                className="mt-6 block w-full py-2.5 rounded-xl bg-primary text-white text-center font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-colors"
              >
                S&apos;abonner
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
