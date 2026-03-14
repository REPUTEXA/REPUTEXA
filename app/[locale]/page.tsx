'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe, ShieldCheck, MessageSquareWarning, Star, Zap, BarChart2, ChevronRight, Check } from 'lucide-react';
import { Chatbot } from '@/components/chatbot';
import { LanguageSelector } from '@/components/language-selector';
import { DemoDashboard } from '@/components/demo-dashboard';
import { LandingDashboardMockup } from '@/components/landing/landing-dashboard-mockup';
import { Logo } from '@/components/logo';
import { formatPrice } from '@/lib/format-price';

function StarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-star w-4 h-4 fill-star text-star"
      aria-hidden="true"
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

const FAQ_KEYS = ['googleMaps', 'iaDetectable', 'installTime', 'gratuit14j'] as const;

export default function HomePage() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openDemo, setOpenDemo] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* NAVBAR - Glassmorphism */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 sm:h-16 border-b border-white/10 bg-navy/70 dark:bg-navy/80 backdrop-blur-md backdrop-saturate-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-2 safe-area-nav">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0" aria-label="REPUTEXA">
            <Logo />
            <span className="font-display font-bold text-white text-base sm:text-lg tracking-heading">REPUTEXA</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="#fonctionnalités"
              className="text-sm text-white/60 hover:text-white transition-colors font-medium"
            >
              {t('nav.features')}
            </a>
            <a
              href="#tarifs"
              className="text-sm text-white/60 hover:text-white transition-colors font-medium"
            >
              {t('nav.pricing')}
            </a>
            <a
              href="#témoignages"
              className="text-sm text-white/60 hover:text-white transition-colors font-medium"
            >
              {t('nav.testimonials')}
            </a>
            <a
              href="#faq"
              className="text-sm text-white/60 hover:text-white transition-colors font-medium"
            >
              {t('nav.faq')}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector variant="dark" />
            <Link
              href="/login"
              className="text-sm text-white/70 hover:text-white font-medium transition-colors"
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO + DASHBOARD WRAPPER (fond dégradé continu) */}
      <div className="hero-dashboard-bg">
        {/* HERO */}
        <section className="pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-20 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative safe-area-section">
            <div className="text-center max-w-3xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/70 font-medium mb-4 sm:mb-6 animate-fade-up tracking-prose"
              style={{ animationDelay: '0.1s', opacity: 0 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {t('hero.pill')}
            </div>
            <h1
              className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-4 sm:mb-6 animate-fade-up tracking-heading"
              style={{ animationDelay: '0.1s', opacity: 0 }}
            >
              {t('hero.headline')}
              <span className="text-gradient">{t('hero.headlineHighlight')}</span>
            </h1>
            <p
              className="text-base sm:text-lg text-white/60 leading-relaxed mb-6 sm:mb-8 animate-fade-up tracking-prose"
              style={{ animationDelay: '0.2s', opacity: 0 }}
            >
              {t('hero.tagline')}
            </p>
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-up"
              style={{ animationDelay: '0.3s', opacity: 0 }}
            >
              <Link
                href="/signup?mode=trial"
                className="gradient-primary text-white font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-glow cta-pulse-soft text-sm sm:text-base"
              >
                {t('hero.ctaPrimary')} <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={() => setOpenDemo(true)}
                className="text-white/70 font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl flex items-center gap-2 border border-white/15 hover:bg-white/5 active:scale-[0.98] transition-all text-sm sm:text-base"
              >
                {t('hero.ctaSecondary')}
              </button>
            </div>
            <p className="text-xs text-white/30 mt-4 tracking-prose">{t('hero.trialInfo')}</p>
          </div>
          </div>
        </section>

        {/* CENTRE DE COMMANDE IA */}
        <section className="py-12 sm:py-20 md:py-24 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative safe-area-section">
            <div className="text-center mb-6 sm:mb-10">
              <span className="inline-block bg-[#2563eb]/10 text-[#2563eb] px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-3 sm:mb-4">
                CENTRE DE COMMANDE IA
              </span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-heading">
                Dashboard e-réputation intelligent
              </h2>
            </div>

            <LandingDashboardMockup />
          </div>
        </section>
      </div>

      {/* SÉPARATEUR + SECTEURS (blanc cassé) */}
      <div className="border-t border-white/5" />

      <section className="py-10 border-y border-slate-200/30" style={{ backgroundColor: 'hsl(var(--navy) / 0.05)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap justify-center items-center gap-6 sm:gap-8">
          {(['0', '1', '2', '3', '4', '5'] as const).map((i) => (
            <span key={i} className="text-sm font-semibold text-muted-foreground">
              {t(`socialProof.${i}`)}
            </span>
          ))}
        </div>
      </section>

      {/* FONCTIONNALITÉS (blanc) */}
      <section id="fonctionnalités" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-foreground mb-3">
              {t('howItWorks.headline')}
            </h2>
            <p className="text-muted-foreground text-lg">{t('howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Globe, key: 'multilingue', iconBg: 'bg-[#2563eb]/5', iconColor: 'text-primary', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: ShieldCheck, key: 'bouclier', iconBg: 'bg-red-50', iconColor: 'text-red-500', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: MessageSquareWarning, key: 'whatsapp', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: Zap, key: 'capture', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700' },
              { icon: Star, key: 'boostSeo', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700' },
              { icon: BarChart2, key: 'reporting', iconBg: 'bg-green-50', iconColor: 'text-green-600', badgeClass: 'border-slate-300 bg-slate-100 text-slate-700' },
            ].map(({ icon: Icon, key, iconBg, iconColor, badgeClass }) => (
              <div key={key} className="relative bg-card rounded-2xl sm:rounded-3xl border border-border p-6 shadow-sm hover:shadow-apple transition-all duration-300 ease-in-out group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide mb-3 ${badgeClass}`}>
                  {t(`howItWorks.cards.${key}.badge`)}
                </span>
                <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
                  {t(`howItWorks.cards.${key}.title`)}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t(`howItWorks.cards.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES (blanc cassé) */}
      <section id="témoignages" className="py-16 sm:py-20 bg-muted/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-foreground mb-3">
              {t('testimonials.headline')}
            </h2>
            <p className="text-muted-foreground">{t('testimonials.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex gap-0.5 mb-4">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-5">
                &quot;{t('testimonials.items.1.quote')}&quot;
              </p>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('testimonials.items.1.name')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('testimonials.items.1.role')}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex gap-0.5 mb-4">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-5">
                &quot;{t('testimonials.items.2.quote')}&quot;
              </p>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('testimonials.items.2.name')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('testimonials.items.2.role')}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex gap-0.5 mb-4">
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-5">
                &quot;{t('testimonials.items.3.quote')}&quot;
              </p>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('testimonials.items.3.name')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('testimonials.items.3.role')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TARIFS (blanc) */}
      <section id="tarifs" className="py-16 sm:py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-foreground mb-3">
              {t('pricing.headline')}
            </h2>
            <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* Plan Vision */}
            <div className="flex flex-col h-full rounded-2xl sm:rounded-3xl border p-6 relative bg-card border-border shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(75,115,255,0.12)]">
              <div className="mb-5">
                <p className="font-display font-bold text-lg text-foreground">
                  {t('pricing.vision.name')}
                </p>
                <p className="text-xs font-medium mt-0.5 text-muted-foreground">
                  {t('pricing.vision.for')}
                </p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-display font-bold text-foreground">
                  {formatPrice(locale, t('pricing.vision.price'))}
                </span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_reponses')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_reporting_vision')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_ia_tests')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_langues_vision')}</span>
                </li>
              </ul>
              <p className="text-xs text-emerald-600 font-medium mb-4">{t('pricing.trialMention')}</p>
              <Link
                href="/signup?mode=checkout&plan=vision"
                className="block text-center py-3 min-h-[44px] text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out gradient-primary text-white hover:opacity-90 active:scale-[0.98]"
              >
                {t('pricing.ctaSubscribe')}
              </Link>
              <Link
                href="/signup?mode=trial"
                className="block text-center py-2 mt-2 text-sm font-medium text-primary underline underline-offset-2 hover:no-underline transition-all duration-300"
              >
                {t('pricing.ctaTrial')}
              </Link>
            </div>

            {/* Plan Pulse - LE PLUS POPULAIRE */}
            <div className="flex flex-col h-full rounded-2xl sm:rounded-3xl border p-6 relative gradient-primary text-white border-transparent shadow-glow scale-[1.02] sm:scale-105 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(75,115,255,0.25)]">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 bg-white text-primary rounded-full">
                {t('pricing.pulse.badge')}
              </span>
              <div className="mb-5">
                <p className="font-display font-bold text-lg text-white">
                  {t('pricing.pulse.name')}
                </p>
                <p className="text-xs font-medium mt-0.5 text-white/70">
                  {t('pricing.pulse.for')}
                </p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-display font-bold text-white">
                  {formatPrice(locale, t('pricing.pulse.price'))}
                </span>
                </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_reponses')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_alertes')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_reporting_pulse')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_suppression')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_ia_tests')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-white" aria-hidden="true" />
                  <span className="text-white/80">{t('pricing.comparison.card_langues_autres')}</span>
                </li>
              </ul>
              <p className="text-xs text-emerald-200 font-medium mb-4">{t('pricing.trialMention')}</p>
              <Link
                href="/signup?mode=checkout&plan=pulse"
                className="block text-center py-3 min-h-[44px] text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out bg-white text-primary hover:bg-white/90 active:scale-[0.98]"
              >
                {t('pricing.ctaSubscribe')}
              </Link>
              <Link
                href="/signup?mode=trial"
                className="block text-center py-2 mt-2 text-sm font-medium text-white/90 underline underline-offset-2 hover:no-underline transition-all duration-300"
              >
                {t('pricing.ctaTrial')}
              </Link>
            </div>

            {/* Plan Zenith - bordure lumineuse bleue (offre ultime) */}
            <div className="flex flex-col h-full rounded-2xl sm:rounded-3xl border-2 border-[#2563eb]/50 p-6 relative bg-card shadow-[0_0_24px_rgba(37,99,235,0.12)] transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(37,99,235,0.2)] hover:border-primary/60">
              <div className="mb-5">
                <p className="font-display font-bold text-lg text-foreground">
                  {t('pricing.zenith.name')}
                </p>
                <p className="text-xs font-medium mt-0.5 text-muted-foreground">
                  {t('pricing.zenith.for')}
                </p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-display font-bold text-foreground">
                  {formatPrice(locale, t('pricing.zenith.price'))}
                </span>
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_reponses')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_triple')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_alertes')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_reporting_pulse')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80 font-semibold">{t('pricing.comparison.card_boost_seo')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_suppression')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_ai_capture')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80 font-semibold">{t('pricing.comparison.card_consultant')}</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4 h-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-foreground/80">{t('pricing.comparison.card_langues_autres')}</span>
                </li>
              </ul>
              <p className="text-xs text-emerald-600 font-medium mb-4">{t('pricing.trialMention')}</p>
              <Link
                href="/signup?mode=checkout&plan=zenith"
                className="block text-center py-3 min-h-[44px] text-sm font-semibold rounded-2xl transition-all duration-300 ease-in-out gradient-primary text-white hover:opacity-90 active:scale-[0.98]"
              >
                {t('pricing.ctaSubscribe')}
              </Link>
              <Link
                href="/signup?mode=trial"
                className="block text-center py-2 mt-2 text-sm font-medium text-primary underline underline-offset-2 hover:no-underline transition-all duration-300"
              >
                {t('pricing.ctaTrial')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ (blanc cassé) */}
      <section
        id="faq"
        className="scroll-mt-20 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/40"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-transparent shadow hover:bg-primary/80 bg-[#2563eb]/10 text-[#2563eb] border-0 mb-4">
              {t('nav.faq')}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">
              {t('faq.headline')}
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ_KEYS.map((key) => (
              <div
                key={key}
                className={`bg-white rounded-xl overflow-hidden transition-all duration-200 ${
                  openFaq === key
                    ? 'border border-slate-300/80 shadow-sm'
                    : 'border border-slate-200/90 hover:border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === key ? null : key)}
                  className="w-full min-h-[44px] p-5 text-left flex items-center justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-inset transition-colors duration-300"
                >
                  <span className="font-display font-semibold text-slate-900 pr-4">
                    {t(`faq.items.${key}.q`)}
                  </span>
                  <ChevronRight
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                      openFaq === key ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-out ${
                    openFaq === key ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 pb-5 pt-0">
                    <p className="text-slate-600 leading-relaxed">
                      {t(`faq.items.${key}.a`)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="py-20 gradient-hero">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-white/60 mb-8">{t('cta.subtitle')}</p>
              <Link
                href="/signup?mode=trial"
                className="inline-flex items-center justify-center gap-2 min-h-[44px] gradient-primary text-white font-semibold px-8 py-3 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all duration-300 ease-in-out shadow-glow"
              >
            {t('cta.button')} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" aria-label="REPUTEXA">
            <Logo size="sm" />
            <span className="font-display font-bold text-white">REPUTEXA</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6" aria-label="Pied de page">
            <Link href="/legal" className="text-sm text-white/50 hover:text-white transition-colors">
              Mentions légales
            </Link>
            <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">
              {t('footer.terms')}
            </Link>
            <Link href="/contact" className="text-sm text-white/50 hover:text-white transition-colors">
              Contact
            </Link>
          </nav>
          <p className="text-sm text-white/30">{t('footer.rights')}</p>
        </div>
      </footer>

      {/* DEMO + CHATBOT */}
      {openDemo && <DemoDashboard onClose={() => setOpenDemo(false)} />}
      {!openDemo && <Chatbot />}
    </div>
  );
}
