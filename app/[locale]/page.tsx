import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  Star,
  Bell,
  TrendingUp,
  BarChart2,
  MessageCircle,
  Shield,
  ChevronRight,
  FileText,
  Check,
} from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('HomePage');

  return (
    <div className="min-h-screen">
      {/* Header - Dark */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              RepuAI
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-zinc-300 hover:text-white">
              {t('nav.features')}
            </Link>
            <Link href="#pricing" className="text-sm text-zinc-300 hover:text-white">
              {t('nav.pricing')}
            </Link>
            <Link href="#testimonials" className="text-sm text-zinc-300 hover:text-white">
              {t('nav.testimonials')}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm text-zinc-300 hover:text-white"
            >
              {t('nav.login')}
            </Link>
            <Link
              href="/sign-up"
              className="shiny-button rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
            >
              {t('nav.trial')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero - Dark */}
      <section className="bg-zinc-950 pt-28 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-full border border-zinc-700/50 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-300 w-fit mb-8">
            {t('hero.pill')}
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('hero.title1')}
            <span className="text-blue-400">{t('hero.titleHighlight')}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-400">
            {t('hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/sign-up"
              className="shiny-button inline-flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
            >
              {t('hero.ctaPrimary')}
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="#dashboard-preview"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-6 py-3 font-medium text-white transition hover:bg-zinc-800"
            >
              {t('hero.ctaSecondary')}
            </Link>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            {t('hero.trialInfo')}
          </p>
        </div>

        {/* Dashboard Preview */}
        <div
          id="dashboard-preview"
          className="mx-auto mt-16 max-w-6xl px-6"
        >
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-zinc-700 pb-4">
              <span className="text-sm font-medium text-zinc-400">
                Reputation Analytics
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500">Live</span>
              </div>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <p className="text-xs text-zinc-500">Note moyenne</p>
                <p className="mt-1 text-2xl font-bold text-white">4.2</p>
                <div className="mt-2 flex gap-0.5">
                  {[1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <p className="text-xs text-zinc-500">Avis traités</p>
                <p className="mt-1 text-2xl font-bold text-white">127</p>
              </div>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <p className="text-xs text-zinc-500">Tendance</p>
                <div className="mt-1 flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-semibold">+12%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 h-24 rounded-lg bg-zinc-800/50 flex items-center justify-center">
              <span className="text-sm text-zinc-500">Graphique d&apos;évolution</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Light */}
      <section id="features" className="scroll-mt-20 border-t border-zinc-200 bg-[#f8f8f8] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex flex-wrap justify-center gap-3">
            {['Restaurants', 'Coiffeurs', 'Hôtels', 'Spas & Beauté', 'Cafés', 'Cliniques'].map(
              (cat) => (
                <button
                  key={cat}
                  className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  {cat}
                </button>
              )
            )}
          </div>
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            {t('features.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-zinc-600">
            {t('features.subtitle')}
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: FileText,
                iconBg: 'bg-blue-100 text-blue-600',
                titleKey: 'features.ai.title',
                descKey: 'features.ai.desc',
              },
              {
                icon: Bell,
                iconBg: 'bg-purple-100 text-purple-600',
                titleKey: 'features.alerts.title',
                descKey: 'features.alerts.desc',
              },
              {
                icon: TrendingUp,
                iconBg: 'bg-emerald-100 text-emerald-600',
                titleKey: 'features.tracking.title',
                descKey: 'features.tracking.desc',
              },
              {
                icon: BarChart2,
                iconBg: 'bg-amber-100 text-amber-600',
                titleKey: 'features.sentiment.title',
                descKey: 'features.sentiment.desc',
              },
              {
                icon: MessageCircle,
                iconBg: 'bg-cyan-100 text-cyan-600',
                titleKey: 'features.multiplatform.title',
                descKey: 'features.multiplatform.desc',
              },
              {
                icon: Shield,
                iconBg: 'bg-red-100 text-red-600',
                titleKey: 'features.brand.title',
                descKey: 'features.brand.desc',
              },
            ].map((item) => (
              <div
                key={item.titleKey}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div
                  className={`inline-flex rounded-lg p-3 ${item.iconBg}`}
                >
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-zinc-900">
                  {t(item.titleKey as 'features.ai.title')}
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  {t(item.descKey as 'features.ai.desc')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials - Light */}
      <section id="testimonials" className="scroll-mt-20 border-t border-zinc-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            {t('testimonials.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-zinc-600">
            {t('testimonials.subtitle')}
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-5 w-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-zinc-700">
                  &quot;{t(`testimonials.items.${i}.quote`)}&quot;
                </p>
                <p className="mt-4 font-semibold text-zinc-900">
                  {t(`testimonials.items.${i}.name`)}
                </p>
                <p className="text-sm text-zinc-500">
                  {t(`testimonials.items.${i}.role`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Light */}
      <section id="pricing" className="scroll-mt-20 border-t border-zinc-200 bg-[#f8f8f8] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-zinc-900">
            {t('pricing.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-zinc-600">
            {t('pricing.subtitle')}
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Starter */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-zinc-900">{t('pricing.starter.name')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('pricing.starter.for')}</p>
              <p className="mt-4 text-3xl font-bold text-zinc-900">
                29€<span className="text-base font-normal text-zinc-500">/mois</span>
              </p>
              <ul className="mt-6 space-y-3">
                {['1 établissement', '50 réponses IA/mois', 'Google & TripAdvisor', 'Alertes email', 'Dashboard basique'].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-700">
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 block w-full rounded-lg bg-blue-500 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-600"
              >
                {t('pricing.starter.cta')}
              </Link>
            </div>

            {/* Pro - Highlighted */}
            <div className="relative rounded-xl border-2 border-blue-500 bg-gradient-to-b from-blue-600 to-blue-700 p-6 text-white shadow-xl">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-800 px-3 py-0.5 text-xs font-medium">
                {t('pricing.pro.badge')}
              </span>
              <h3 className="mt-2 font-bold">{t('pricing.pro.name')}</h3>
              <p className="mt-1 text-sm text-blue-100">{t('pricing.pro.for')}</p>
              <p className="mt-4 text-3xl font-bold">
                79€<span className="text-base font-normal text-blue-200">/mois</span>
              </p>
              <ul className="mt-6 space-y-3">
                {['5 établissements', 'Réponses IA illimitées', 'Toutes les plateformes', 'Alertes temps réel', 'Analytics avancés', 'Support prioritaire'].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-blue-50">
                      <Check className="h-4 w-4 shrink-0 text-blue-200" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 block w-full rounded-lg border-2 border-white bg-white py-3 text-center text-sm font-medium text-blue-600 transition hover:bg-blue-50"
              >
                {t('pricing.pro.cta')}
              </Link>
            </div>

            {/* Agence */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-zinc-900">{t('pricing.agency.name')}</h3>
              <p className="mt-1 text-sm text-zinc-500">{t('pricing.agency.for')}</p>
              <p className="mt-4 text-3xl font-bold text-zinc-900">
                199€<span className="text-base font-normal text-zinc-500">/mois</span>
              </p>
              <ul className="mt-6 space-y-3">
                {['Établissements illimités', 'Réponses IA illimitées', 'White-label', 'API access', 'Manager de comptes', 'Intégration CRM'].map(
                  (f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-700">
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      {f}
                    </li>
                  )
                )}
              </ul>
              <Link
                href="/sign-up"
                className="mt-6 block w-full rounded-lg bg-blue-500 py-3 text-center text-sm font-medium text-white transition hover:bg-blue-600"
              >
                {t('pricing.agency.cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final - Dark */}
      <section className="bg-zinc-950 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            {t('cta.title')}
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            {t('cta.subtitle')}
          </p>
          <Link
            href="/sign-up"
            className="shiny-button mt-8 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-8 py-4 text-lg font-medium text-white transition hover:bg-blue-600"
          >
            {t('cta.button')}
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer - Dark */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">RepuAI</span>
          </div>
          <p className="text-sm text-zinc-500">{t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
