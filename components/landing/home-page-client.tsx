'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  BarChart2,
  ChevronRight,
  Globe,
  Menu,
  MessageSquareWarning,
  ShieldCheck,
  Star,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { LanguageSelector } from '@/components/language-selector';
import { CurrencySelector } from '@/components/currency-selector';
import { Logo } from '@/components/logo';
import { LandingTestimonialsMarquee } from '@/components/landing/landing-testimonials-marquee';
import { HOME_TESTIMONIAL_COUNT } from '@/lib/landing/home-testimonial-keys';
import type { ReputexaPlatformReviewCard } from '@/lib/reputexa-platform-reviews/landing-data';

const ChatbotLazy = dynamic(
  () => import('@/components/chatbot').then((m) => ({ default: m.Chatbot })),
  { ssr: false },
);

/** Évite mismatch d’hydratation : rien côté serveur, puis chatbot uniquement après mount client. */
function ChatbotClientOnly() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <ChatbotLazy />;
}

/** Chunks séparés : moins de JS initial à parser (tunnel + pricing + footer sont lourds). */
const tunnelColSkeleton = 'min-h-[280px] rounded-2xl border border-white/5 bg-white/[0.03] animate-pulse lg:min-h-[360px]';

const LandingWhatsappTunnelCopy = dynamic(
  () =>
    import('@/components/landing/landing-whatsapp-tunnel')
      .then((m) => ({ default: m.LandingWhatsappTunnelCopy }))
      .catch(() =>
        import('@/components/landing/tunnel-demo-import-fallback').then((m) => ({
          default: m.TunnelCopyFallback,
        }))
      ),
  { loading: () => <div className={tunnelColSkeleton} aria-hidden /> },
);

const LandingWhatsappTunnel = dynamic(
  () =>
    import('@/components/landing/landing-whatsapp-tunnel')
      .then((m) => ({ default: m.LandingWhatsappTunnel }))
      .catch(() =>
        import('@/components/landing/tunnel-demo-import-fallback').then((m) => ({
          default: m.TunnelInteractiveFallback,
        }))
      ),
  { loading: () => <div className={tunnelColSkeleton} aria-hidden /> },
);

const LandingGoogleFlywheel = dynamic(
  () => import('@/components/landing/landing-google-flywheel').then((m) => ({ default: m.LandingGoogleFlywheel })),
  { loading: () => <div className="min-h-[200px] bg-slate-50/50 dark:bg-slate-950/20 animate-pulse" aria-hidden /> },
);

const LandingPricingSection = dynamic(
  () => import('@/components/landing/landing-pricing-section').then((m) => ({ default: m.LandingPricingSection })),
  { loading: () => <div className="min-h-[420px] bg-white animate-pulse" aria-hidden /> },
);

const LandingFooter = dynamic(
  () => import('@/components/landing/landing-footer').then((m) => ({ default: m.LandingFooter })),
  { loading: () => <div className="min-h-[120px] bg-[hsl(var(--navy))] animate-pulse" aria-hidden /> },
);

const FAQ_KEYS = ['googleMaps', 'iaDetectable', 'installTime', 'gratuit14j'] as const;

/** Ancre partagée : nav « Démo produit » + CTA « Voir la démo » → section tunnel WhatsApp. */
const TUNNEL_SECTION_ID = 'demo-interactive';

const FEATURE_CARD_ORDER = ['multilingue', 'bouclier', 'whatsapp', 'capture', 'boostSeo', 'reporting'] as const;
type FeatureCardId = (typeof FEATURE_CARD_ORDER)[number];

const FEATURE_CARD_STYLES: Record<
  FeatureCardId,
  { Icon: LucideIcon; iconBg: string; iconColor: string; badgeClass: string }
> = {
  multilingue: {
    Icon: Globe,
    iconBg: 'bg-[#2563eb]/5',
    iconColor: 'text-primary',
    badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700',
  },
  bouclier: {
    Icon: ShieldCheck,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700',
  },
  whatsapp: {
    Icon: MessageSquareWarning,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeClass: 'border-indigo-400/60 bg-indigo-500/15 text-indigo-700',
  },
  capture: {
    Icon: Zap,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700',
  },
  boostSeo: {
    Icon: Star,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    badgeClass: 'border-emerald-400/60 bg-emerald-500/15 text-emerald-700',
  },
  reporting: {
    Icon: BarChart2,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
  },
};

const FEATURES_GRID_COUNT = FEATURE_CARD_ORDER.length;

type HomePageClientProps = {
  platformReviewCards: ReputexaPlatformReviewCard[];
};

export function HomePageClient({ platformReviewCards }: HomePageClientProps) {
  const t = useTranslations('HomePage');
  useLocale();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  const scrollToTunnel = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(TUNNEL_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${TUNNEL_SECTION_ID}`);
    }
    setMobileNavOpen(false);
  }, []);

  const navLinkClass =
    'text-sm text-white/60 hover:text-white transition-colors font-medium py-2 block w-full text-left md:inline md:w-auto md:py-0';

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav className="fixed top-0 inset-x-0 z-50 h-14 sm:h-16 border-b border-white/10 bg-navy/70 dark:bg-navy/80 backdrop-blur-md backdrop-saturate-150">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 safe-area-nav">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 sm:gap-2.5 justify-self-start"
            aria-label={t('nav.brandAria')}
          >
            <Logo priority />
            <span className="font-display font-bold text-white text-base sm:text-lg tracking-heading uppercase truncate">
              {t('nav.brandText')}
            </span>
          </Link>
          <div className="hidden min-w-0 md:flex items-center justify-center gap-6">
            <HoverTooltip label={t('nav.demoHint')} side="bottom">
              <a
                href={`#${TUNNEL_SECTION_ID}`}
                onClick={scrollToTunnel}
                className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                aria-label={t('nav.demoSectionAria')}
              >
                {t('nav.demo')}
              </a>
            </HoverTooltip>
            <HoverTooltip label={t('nav.featuresHint')} side="bottom">
              <a
                href="#features"
                className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                aria-label={t('nav.featuresSectionAria')}
              >
                {t('nav.features')}
              </a>
            </HoverTooltip>
            <HoverTooltip label={t('nav.pricingHint')} side="bottom">
              <a
                href="#pricing"
                className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                aria-label={t('nav.pricingSectionAria')}
              >
                {t('nav.pricing')}
              </a>
            </HoverTooltip>
            <HoverTooltip label={t('nav.testimonialsHint')} side="bottom">
              <a
                href="#testimonials"
                className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                aria-label={t('nav.testimonialsSectionAria')}
              >
                {t('nav.testimonials')}
              </a>
            </HoverTooltip>
            <HoverTooltip label={t('nav.faqHint')} side="bottom">
              <a
                href="#faq"
                className="text-sm text-white/60 hover:text-white transition-colors font-medium"
                aria-label={t('nav.faqSectionAria')}
              >
                {t('nav.faq')}
              </a>
            </HoverTooltip>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3 justify-self-end">
            <LanguageSelector variant="dark" hintScope="site" />
            <CurrencySelector variant="dark" />
            <HoverTooltip label={t('nav.loginHint')} side="bottom">
              <Link
                href="/login"
                className="text-xs sm:text-sm text-white/70 hover:text-white font-medium transition-colors whitespace-nowrap"
              >
                {t('nav.login')}
              </Link>
            </HoverTooltip>
            <button
              type="button"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10 transition-colors"
              aria-expanded={mobileNavOpen}
              aria-controls="landing-mobile-nav"
              onClick={() => setMobileNavOpen(true)}
              aria-label={t('nav.menuOpenAria')}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileNavOpen ? (
          <>
            <motion.div
              key="landing-nav-backdrop"
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-hidden
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.aside
              key="landing-nav-panel"
              id="landing-mobile-nav"
              className="fixed top-0 right-0 bottom-0 z-[61] flex w-[min(100%,20rem)] flex-col border-l border-white/10 bg-[#0a0f1a]/95 shadow-2xl backdrop-blur-xl safe-area-nav"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
                <span className="text-sm font-semibold text-white">{t('nav.mobileNavTitle')}</span>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label={t('nav.menuCloseAria')}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4" aria-label={t('nav.mobileNavTitle')}>
                <HoverTooltip label={t('nav.demoHint')} side="top">
                  <a
                    href={`#${TUNNEL_SECTION_ID}`}
                    onClick={scrollToTunnel}
                    className={navLinkClass}
                    aria-label={t('nav.demoSectionAria')}
                  >
                    {t('nav.demo')}
                  </a>
                </HoverTooltip>
                <HoverTooltip label={t('nav.featuresHint')} side="top">
                  <a
                    href="#features"
                    className={navLinkClass}
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={t('nav.featuresSectionAria')}
                  >
                    {t('nav.features')}
                  </a>
                </HoverTooltip>
                <HoverTooltip label={t('nav.pricingHint')} side="top">
                  <a
                    href="#pricing"
                    className={navLinkClass}
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={t('nav.pricingSectionAria')}
                  >
                    {t('nav.pricing')}
                  </a>
                </HoverTooltip>
                <HoverTooltip label={t('nav.testimonialsHint')} side="top">
                  <a
                    href="#testimonials"
                    className={navLinkClass}
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={t('nav.testimonialsSectionAria')}
                  >
                    {t('nav.testimonials')}
                  </a>
                </HoverTooltip>
                <HoverTooltip label={t('nav.faqHint')} side="top">
                  <a
                    href="#faq"
                    className={navLinkClass}
                    onClick={() => setMobileNavOpen(false)}
                    aria-label={t('nav.faqSectionAria')}
                  >
                    {t('nav.faq')}
                  </a>
                </HoverTooltip>
                <HoverTooltip label={t('nav.loginHint')} side="top">
                  <Link
                    href="/login"
                    className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {t('nav.login')}
                  </Link>
                </HoverTooltip>
              </nav>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="hero-dashboard-bg">
        <section className="pt-24 sm:pt-28 md:pt-32 pb-12 sm:pb-20 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative safe-area-section">
            <div className="text-center max-w-3xl mx-auto">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-xs text-white/70 font-medium mb-4 sm:mb-6 animate-fade-up tracking-prose"
                style={{ animationDelay: '0.1s', opacity: 0 }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {t('hero.pill')}
              </div>
              <h1
                className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 sm:mb-6 animate-fade-up tracking-heading bg-clip-text text-transparent bg-gradient-to-b from-white via-zinc-100 to-zinc-500"
                style={{ animationDelay: '0.1s', opacity: 0 }}
              >
                {t.rich('hero.headlineRich', {
                  gradient: (chunks) => (
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-[#2563eb]">
                      {chunks}
                    </span>
                  ),
                })}
              </h1>
              <p
                className="text-base sm:text-lg text-white/60 leading-relaxed mb-6 sm:mb-8 animate-fade-up tracking-prose"
                style={{ animationDelay: '0.2s', opacity: 0 }}
              >
                {t('hero.tagline')}
              </p>
              <p
                className="text-sm sm:text-base text-white/45 leading-relaxed max-w-2xl mx-auto mb-6 sm:mb-8 animate-fade-up tracking-prose"
                style={{ animationDelay: '0.25s', opacity: 0 }}
              >
                {t('hero.audience')}
              </p>
              <div
                className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 animate-fade-up"
                style={{ animationDelay: '0.3s', opacity: 0 }}
              >
                <Link
                  href="/signup?mode=trial"
                  className="gradient-primary text-white font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-glow cta-pulse-soft text-sm sm:text-base"
                >
                  {t('hero.ctaPrimary')} <ChevronRight className="w-4 h-4" aria-hidden />
                </Link>
                <a
                  href={`#${TUNNEL_SECTION_ID}`}
                  onClick={scrollToTunnel}
                  className="text-white/70 font-semibold px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl inline-flex items-center justify-center gap-2 border border-white/15 hover:bg-white/5 active:scale-[0.98] transition-all text-sm sm:text-base"
                  aria-label={t('nav.demoSectionAria')}
                >
                  {t('hero.ctaSecondary')}
                </a>
              </div>
              <p className="text-xs text-white/30 mt-4 tracking-prose">{t('hero.trialInfo')}</p>
            </div>
          </div>
        </section>

        <ScrollReveal>
          <section
            id={TUNNEL_SECTION_ID}
            className="py-14 sm:py-20 md:py-28 relative overflow-hidden scroll-mt-28"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative safe-area-section">
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
                <div className="order-2 lg:order-1">
                  <LandingWhatsappTunnelCopy />
                </div>
                <div className="order-1 lg:order-2">
                  <LandingWhatsappTunnel />
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>

      <div className="border-t border-white/5" />
      <ScrollReveal>
        <section
          className="py-12 sm:py-14 border-y border-slate-200/30"
          style={{ backgroundColor: 'hsl(var(--navy) / 0.05)' }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap justify-center items-center gap-6 sm:gap-8">
            {(['0', '1', '2', '3', '4', '5'] as const).map((i) => (
              <span key={i} className="text-sm font-semibold text-muted-foreground">
                {t(`socialProof.${i}`)}
              </span>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section id="features" className="scroll-mt-28 py-20 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="font-display text-4xl font-bold text-foreground mb-3">{t('features.headline')}</h2>
              <p className="text-muted-foreground text-lg">{t('features.subtitle')}</p>
              <p className="text-muted-foreground text-sm mt-2">{t('features.countLabel', { count: FEATURES_GRID_COUNT })}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURE_CARD_ORDER.map((id) => {
                const { Icon, iconBg, iconColor, badgeClass } = FEATURE_CARD_STYLES[id];
                return (
                  <div
                    key={id}
                    className="relative bg-card rounded-2xl sm:rounded-3xl border border-border p-6 shadow-sm hover:shadow-apple hover:scale-[1.02] transition-all duration-300 ease-in-out group"
                  >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide mb-3 ${badgeClass}`}>
                    {t(`features.cards.${id}.badge`)}
                  </span>
                  <h3 className="font-display font-semibold text-base sm:text-lg text-foreground mb-2">
                    {t(`features.cards.${id}.title`)}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t(`features.cards.${id}.desc`)}
                  </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <LandingGoogleFlywheel />
      </ScrollReveal>

      <ScrollReveal>
        <section id="testimonials" className="scroll-mt-28 py-20 sm:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Titre : largeur « Cosa … mondo ». Carrousel : même base + 2,5 cm de chaque côté pour le fondu. */}
            <div className="max-w-4xl mx-auto w-full">
              <div className="text-center mb-14">
                <h2 className="font-display text-4xl font-bold text-foreground mb-3">{t('testimonials.headline')}</h2>
                <p className="text-muted-foreground">{t('testimonials.subtitle')}</p>
                <p className="text-muted-foreground text-sm mt-2">
                  {t('testimonials.highlightCountLabel', {
                    count: HOME_TESTIMONIAL_COUNT + platformReviewCards.length,
                  })}
                </p>
              </div>
              <div className="-mx-[2.5cm] w-[calc(100%+5cm)] min-w-0">
                <LandingTestimonialsMarquee dynamicItems={platformReviewCards} />
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <LandingPricingSection />
      </ScrollReveal>

      <ScrollReveal>
        <section id="faq" className="scroll-mt-28 py-20 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto w-full">
          <div className="text-center mb-12">
            <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-transparent shadow hover:bg-primary/80 bg-[#2563eb]/10 text-[#2563eb] border-0 mb-4">
              {t('nav.faq')}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900">{t('faq.headline')}</h2>
          </div>
          <div className="space-y-3">
            {FAQ_KEYS.map((key) => {
              const isOpen = openFaq === key;
              const panelId = `faq-panel-${key}`;
              const buttonId = `faq-trigger-${key}`;
              return (
                <div
                  key={key}
                  className={`bg-white rounded-xl overflow-hidden transition-all duration-200 ${
                    isOpen ? 'border border-slate-300/80 shadow-sm' : 'border border-slate-200/90 hover:border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    aria-label={isOpen ? t('faq.collapseAnswerAria') : t('faq.expandAnswerAria')}
                    onClick={() => setOpenFaq(isOpen ? null : key)}
                    className="w-full min-h-[44px] p-5 text-left flex items-center justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 focus-visible:ring-inset transition-colors duration-300"
                  >
                    <span className="font-display font-semibold text-slate-900 pr-4">{t(`faq.items.${key}.q`)}</span>
                    <ChevronRight
                      className={`w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0 ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                      aria-hidden
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    aria-hidden={!isOpen}
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-slate-600 leading-relaxed">{t(`faq.items.${key}.a`)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="py-24 sm:py-28 gradient-hero">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="font-display text-4xl font-bold text-white mb-4">{t('cta.title')}</h2>
            <p className="text-white/60 mb-8">{t('cta.subtitle')}</p>
            <Link
              href="/signup?mode=trial"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] gradient-primary text-white font-semibold px-8 py-3 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all duration-300 ease-in-out shadow-glow"
            >
              {t('cta.button')} <ChevronRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </section>
      </ScrollReveal>

      <LandingFooter />

      <ChatbotClientOnly />
    </div>
  );
}
