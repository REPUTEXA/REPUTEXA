'use client';

import { Fragment } from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp, Search, Star, ArrowRight, ChevronRight } from 'lucide-react';

const STEPS = [
  {
    icon: Star,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeClass: 'border-amber-300/60 bg-amber-50 text-amber-700',
    stepKey: 'step1',
  },
  {
    icon: TrendingUp,
    iconBg: 'bg-[#2563eb]/5',
    iconColor: 'text-primary',
    badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700',
    stepKey: 'step2',
  },
  {
    icon: Search,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700',
    stepKey: 'step3',
  },
] as const;

export function LandingGoogleFlywheel() {
  const t = useTranslations('HomePage.googleFlywheel');

  return (
    <section className="py-16 sm:py-20 bg-muted/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header — même style que la section Fonctionnalités */}
        <div className="text-center mb-12">
          <span className="inline-block bg-[#2563eb]/10 text-[#2563eb] px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-3 sm:mb-4">
            {t('badge')}
          </span>
          <h2 className="font-display text-4xl font-bold text-foreground mb-3">
            {t('headline')}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        {/* 3 étapes — même style de carte que les fonctionnalités */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-0 max-w-5xl mx-auto items-start mb-12">
          {STEPS.map(({ icon: Icon, iconBg, iconColor, badgeClass, stepKey }, index) => (
            <Fragment key={stepKey}>
              <div className="relative bg-card rounded-2xl sm:rounded-3xl border border-border p-6 shadow-sm hover:shadow-apple transition-all duration-300 ease-in-out group">
                {/* Numéro d'étape */}
                <span className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-[#2563eb] text-white text-xs font-bold flex items-center justify-center shadow-md select-none">
                  {index + 1}
                </span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide mb-3 ${badgeClass}`}>
                  {t(`${stepKey}.trigger`)}
                </span>
                <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
                  {t(`${stepKey}.title`)}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(`${stepKey}.result`)}
                </p>
              </div>

              {/* Connecteur fléché entre étapes */}
              {index < STEPS.length - 1 && (
                <div
                  className="hidden md:flex items-center justify-center self-center px-2"
                  aria-hidden
                >
                  <ArrowRight className="w-6 h-6 text-slate-300" />
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Phrase choc — blockquote stylisé */}
        <div className="max-w-3xl mx-auto mb-10">
          <blockquote className="relative bg-card border border-border rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center shadow-sm overflow-hidden">
            {/* Guillemets décoratifs */}
            <span
              className="absolute top-4 left-5 font-display text-7xl leading-none text-[#2563eb]/10 select-none"
              aria-hidden
            >
              {'\u201C'}
            </span>
            <span
              className="absolute bottom-2 right-5 font-display text-7xl leading-none text-[#2563eb]/10 select-none"
              aria-hidden
            >
              {'\u201D'}
            </span>

            <p className="relative z-10 font-display text-xl sm:text-2xl font-bold text-foreground leading-snug">
              {t('equation')}
            </p>
            <span className="inline-flex items-center gap-1.5 mt-5 px-3 py-1 rounded-full border border-[#2563eb]/20 bg-[#2563eb]/5 text-[#2563eb] text-[10px] font-semibold uppercase tracking-wider">
              <Search className="w-3 h-3" aria-hidden />
              {t('equationSource')}
            </span>
          </blockquote>
        </div>

        {/* CTA — lien d'ancrage vers tarifs (smooth scroll via globals.css) */}
        <div className="flex justify-center">
          <a
            href="#pricing"
            className="gradient-primary text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 hover:opacity-90 active:scale-[0.96] transition-transform duration-150 ease-out shadow-glow text-sm sm:text-base"
          >
            {t('cta')} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
