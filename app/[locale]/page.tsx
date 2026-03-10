'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe, ShieldCheck, MessageSquareWarning, Star, Zap, BarChart2, ChevronRight, Check } from 'lucide-react';
import { Chatbot } from '@/components/chatbot';
import { LanguageSelector } from '@/components/language-selector';
import { DemoDashboard } from '@/components/demo-dashboard';
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
  const [scanName, setScanName] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* NAVBAR */}
      <nav className="fixed top-0 inset-x-0 z-50 h-14 sm:h-16 border-b border-white/10 bg-navy/60 backdrop-blur-xl backdrop-saturate-150">
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
            <Link
              href="/signup?mode=trial"
              className="gradient-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              {t('nav.trial')}
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

            {/* SCAN DE RÉPUTATION INTERACTIF */}
            <div className="mt-10 sm:mt-12 max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
              <div className="rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-6 backdrop-blur-sm">
                <p className="text-sm text-white/70 font-medium mb-3">{t('scan.title')}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={scanName}
                    onChange={(e) => { setScanName(e.target.value); setScanResult(null); }}
                    placeholder={t('scan.placeholder')}
                    disabled={scanning}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!scanName.trim() || scanning) return;
                      setScanning(true);
                      setScanResult(null);
                      setTimeout(() => {
                        const base = 8 + (scanName.length % 15) + Math.floor(Math.random() * 6);
                        setScanResult(base);
                        setScanning(false);
                      }, 2200);
                    }}
                    disabled={scanning || !scanName.trim()}
                    className="gradient-primary text-white font-semibold px-5 py-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {t('scan.ctaScan')}
                  </button>
                </div>
                {scanning && (
                  <div className="mt-4 flex items-center gap-2 text-white/80">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    {t('scan.loading')}...
                  </div>
                )}
                {scanResult !== null && !scanning && (
                  <div className="mt-4 p-4 rounded-xl bg-rose-500/20 border border-rose-400/30">
                    <p className="text-rose-100 font-bold text-lg">
                      {t('scan.alert', { count: scanResult })}
                    </p>
                    <Link
                      href="/signup?mode=trial"
                      className="mt-4 block w-full gradient-primary text-white font-bold py-4 px-6 rounded-xl text-center hover:opacity-95 transition-opacity text-base sm:text-lg"
                    >
                      {t('scan.ctaSignup')}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* CENTRE DE COMMANDE IA */}
        <section className="py-12 sm:py-20 md:py-24 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative safe-area-section">
            <div className="text-center mb-6 sm:mb-10">
              <span className="inline-block bg-blue-500/15 text-blue-300 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-3 sm:mb-4">
                CENTRE DE COMMANDE IA
              </span>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-heading">
                Dashboard e-réputation intelligent
              </h2>
            </div>

            <div className="rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/5 shadow-[0_24px_64px_rgba(15,23,42,0.85)] sm:shadow-[0_40px_120px_rgba(15,23,42,0.9)] p-1 sm:p-1.5 dashboard-glow min-w-0">
              <div className="rounded-xl sm:rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden bg-white backdrop-blur-sm">
                <div className="bg-gradient-to-b from-slate-100 to-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 border-b border-slate-200 min-w-0">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" />
                    <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm" />
                  </div>
                  <div className="flex-1 flex justify-center min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm max-w-full">
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
                        className="lucide lucide-lock w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-500 shrink-0"
                        aria-hidden="true"
                      >
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <span className="text-[10px] sm:text-xs text-slate-600 font-medium truncate">
                        app.reputexa.ai/dashboard
                      </span>
                    </div>
                  </div>
                  <div className="w-8 sm:w-16 shrink-0" />
                </div>

                <div className="p-3 sm:p-4 md:p-6 bg-gradient-to-br from-[#f8fafc] to-white">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2 flex-wrap">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                        <span className="text-white font-bold text-xs sm:text-sm">R</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">Mon Restaurant</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500">Tableau de bord</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 flex items-center justify-center">
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
                          className="lucide lucide-bell w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500"
                          aria-hidden="true"
                        >
                          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                        </svg>
                      </div>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-[10px] sm:text-xs font-semibold text-blue-600">JD</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                  <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-1.5 sm:mb-2">
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
                        className="lucide lucide-trending-up w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600"
                        aria-hidden="true"
                      >
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                        <polyline points="16 7 22 7 22 13" />
                      </svg>
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                      4.6/5
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Note moyenne</p>
                  </div>

                  <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-1.5 sm:mb-2">
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
                        className="lucide lucide-message-square-text w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600"
                        aria-hidden="true"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        <path d="M13 8H7" />
                        <path d="M17 12H7" />
                      </svg>
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                      127
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Avis ce mois</p>
                  </div>

                  <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-purple-100 flex items-center justify-center mb-1.5 sm:mb-2">
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
                        className="lucide lucide-zap w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600"
                        aria-hidden="true"
                      >
                        <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                      </svg>
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                      ~10 min
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Temps de réponse</p>
                  </div>

                  <div className="bg-white p-2.5 sm:p-3 md:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-100 flex items-center justify-center mb-1.5 sm:mb-2">
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
                        className="lucide lucide-triangle-alert w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600"
                        aria-hidden="true"
                      >
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                        <path d="M12 9v4" />
                        <path d="M12 17h.01" />
                      </svg>
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900">
                      3
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Actions prioritaires</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                    <h4 className="font-semibold text-slate-900 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2 tracking-prose">
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
                        className="lucide lucide-brain w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0"
                        aria-hidden="true"
                      >
                          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
                          <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
                          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
                          <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
                          <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
                          <path d="M6 18a4 4 0 0 1-1.967-.516" />
                          <path d="M19.967 17.484A4 4 0 0 1 18 18" />
                        </svg>
                        Insights IA de la semaine
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-100">
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
                            className="lucide lucide-triangle-alert w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0"
                            aria-hidden="true"
                          >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                          </svg>
                          <div>
                            <p className="text-xs font-medium text-rose-700">
                              Temps d&apos;attente mentionné 8x
                            </p>
                            <p className="text-xs text-rose-600">
                              Impact estimé : -12 clients/mois
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
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
                            className="lucide lucide-circle-check w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                          <div>
                            <p className="text-xs font-medium text-emerald-700">
                              Qualité du service saluée
                            </p>
                            <p className="text-xs text-emerald-600">+23 mentions positives</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3 sm:p-4 rounded-lg sm:rounded-xl border border-slate-200 shadow-soft min-w-0">
                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm mb-2 sm:mb-3 flex items-center gap-2 tracking-prose">
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
                          className="lucide lucide-chart-no-axes-column w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0"
                          aria-hidden="true"
                        >
                          <line x1="18" x2="18" y1="20" y2="10" />
                          <line x1="12" x2="12" y1="20" y2="4" />
                          <line x1="6" x2="6" y1="20" y2="14" />
                        </svg>
                        Évolution cette semaine
                      </h4>
                      <div className="flex items-end gap-1 sm:gap-2 h-14 sm:h-20">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => {
                          const heights = ['35%', '42%', '28%', '45%', '38%', '52%', '48%'];
                          const isToday = idx === 6;
                          return (
                            <div key={day + idx} className="flex-1 flex flex-col items-center">
                              <div
                                className={`w-full rounded-t transition-all duration-500 ${
                                  isToday ? 'bg-blue-500' : 'bg-slate-200'
                                }`}
                                style={{ height: heights[idx] }}
                              />
                              <span className="text-[10px] text-slate-400 mt-1">{day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* SÉPARATEUR + SECTEURS (blanc cassé) */}
      <div className="border-t border-white/5" />

      <section className="py-10 border-y border-slate-200/30" style={{ backgroundColor: 'hsl(var(--navy) / 0.05)' }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center items-center gap-8">
          {(['0', '1', '2', '3', '4', '5'] as const).map((i) => (
            <span key={i} className="text-sm font-semibold text-muted-foreground">
              {t(`socialProof.${i}`)}
            </span>
          ))}
        </div>
      </section>

      {/* FONCTIONNALITÉS (blanc) */}
      <section id="fonctionnalités" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-foreground mb-3">
              {t('howItWorks.headline')}
            </h2>
            <p className="text-muted-foreground text-lg">{t('howItWorks.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Globe, key: 'multilingue', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: ShieldCheck, key: 'bouclier', iconBg: 'bg-red-50', iconColor: 'text-red-500', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: MessageSquareWarning, key: 'whatsapp', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700' },
              { icon: Zap, key: 'capture', iconBg: 'bg-purple-50', iconColor: 'text-purple-600', badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700' },
              { icon: Star, key: 'boostSeo', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700' },
              { icon: BarChart2, key: 'reporting', iconBg: 'bg-green-50', iconColor: 'text-green-600', badgeClass: 'border-slate-300 bg-slate-100 text-slate-700' },
            ].map(({ icon: Icon, key, iconBg, iconColor, badgeClass }) => (
              <div key={key} className="relative bg-card rounded-2xl border border-border p-6 hover:shadow-md transition-all duration-200 group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide mb-3 ${badgeClass}`}>
                  {t(`howItWorks.cards.${key}.badge`)}
                </span>
                <h3 className="font-display font-bold text-base text-foreground mb-2">
                  {t(`howItWorks.cards.${key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`howItWorks.cards.${key}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES (blanc cassé) */}
      <section id="témoignages" className="py-20 bg-muted/40">
        <div className="max-w-6xl mx-auto px-6">
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
      <section id="tarifs" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-foreground mb-3">
              {t('pricing.headline')}
            </h2>
            <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* Plan Vision */}
            <div className="flex flex-col h-full rounded-2xl border p-6 relative bg-card border-border transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(75,115,255,0.2)]">
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
                className="block text-center py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 gradient-primary text-white hover:opacity-90"
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
            <div className="flex flex-col h-full rounded-2xl border p-6 relative gradient-primary text-white border-transparent shadow-glow scale-105 transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(75,115,255,0.2)]">
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
                className="block text-center py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 bg-white text-primary hover:bg-white/90"
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
            <div className="flex flex-col h-full rounded-2xl border p-6 relative bg-card border-border transition-all duration-300 ease-out hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(75,115,255,0.2)] hover:border-primary/50 border-2 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
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
                  <span className="text-foreground/80">{t('pricing.comparison.card_langues_autres')}</span>
                </li>
              </ul>
              <p className="text-xs text-emerald-600 font-medium mb-4">{t('pricing.trialMention')}</p>
              <Link
                href="/signup?mode=checkout&plan=zenith"
                className="block text-center py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 gradient-primary text-white hover:opacity-90"
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
          <p className="text-center mt-8">
            <Link
              href="/pricing"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Voir le tableau comparatif →
            </Link>
          </p>
        </div>
      </section>

      {/* FAQ (blanc cassé) */}
      <section
        id="faq"
        className="scroll-mt-20 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-muted/40"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-transparent shadow hover:bg-primary/80 bg-blue-100 text-blue-700 border-0 mb-4">
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
                  className="w-full p-5 text-left flex items-center justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-inset"
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
                className="inline-flex items-center gap-2 gradient-primary text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-glow"
              >
            {t('cta.button')} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2" aria-label="REPUTEXA">
            <Logo size="sm" />
            <span className="font-display font-bold text-white">REPUTEXA</span>
          </Link>
          <p className="text-sm text-white/30">{t('footer.rights')}</p>
        </div>
      </footer>

      {/* DEMO + CHATBOT */}
      {openDemo && <DemoDashboard onClose={() => setOpenDemo(false)} />}
      {!openDemo && <Chatbot />}
    </div>
  );
}
