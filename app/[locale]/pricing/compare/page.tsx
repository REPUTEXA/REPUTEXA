'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PLAN_DISPLAY_CONFIG, PLAN_ORDER } from '@/config/pricing-plan-display';

/** Classes Tailwind (API), hors littéraux dans le JSX pour le linter. */
const COMPARE_PLAN_CARD_RING_HIGHLIGHT =
  'ring-2 ring-[#2563eb]/35 border-[#2563eb]/50' as const;
const COMPARE_PLAN_CARD_RING_DEFAULT = 'border-slate-200/90 dark:border-slate-800' as const;

export default function PricingComparePage() {
  const t = useTranslations('PricingPage');
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useLayoutEffect(() => {
    const id = window.location.hash.replace(/^#/, '');
    if (id && ['vision', 'pulse', 'zenith'].includes(id)) {
      requestAnimationFrame(() => {
        document.getElementById(`compare-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const sorted = [...PLAN_DISPLAY_CONFIG].sort(
    (a, b) => PLAN_ORDER.indexOf(a.slug) - PLAN_ORDER.indexOf(b.slug)
  );

  const logoHref = session ? '/dashboard' : '/';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-black/[0.06] dark:border-white/[0.06] bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link
            href={logoHref}
            className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 shrink-0"
            aria-label="REPUTEXA"
          >
            <Logo />
            <span className="font-semibold text-[15px] tracking-tight text-slate-900 dark:text-slate-50">REPUTEXA</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/pricing"
              className="text-[#2563eb] dark:text-blue-400 hover:underline underline-offset-2 whitespace-nowrap"
            >
              {t('compareBackToPricing')}
            </Link>
            {session ? (
              <Link href="/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                {t('backToDashboard')}
              </Link>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-[1.75rem] sm:text-[2.25rem] font-semibold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
            {t('compareTitle')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-3 text-[15px] sm:text-base leading-relaxed">
            {t('compareSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6">
          {sorted.map((plan) => {
            const slug = plan.slug;
            const isZenith = plan.primary;
            const ring = isZenith ? COMPARE_PLAN_CARD_RING_HIGHLIGHT : COMPARE_PLAN_CARD_RING_DEFAULT;

            return (
              <section
                key={slug}
                id={`compare-${slug}`}
                className={`scroll-mt-28 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm p-6 sm:p-7 flex flex-col ${ring}`}
              >
                {plan.badgeKey ? (
                  <p
                    className={`text-center text-[11px] font-bold uppercase tracking-wider mb-2 ${
                      isZenith ? 'text-[#2563eb] dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t(plan.badgeKey)}
                  </p>
                ) : null}
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 text-center">
                  {t(plan.titleKey)}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center mt-2 leading-relaxed">
                  {t(plan.descKey)}
                </p>

                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500 mb-3">
                    {t('compareBulletsHeading')}
                  </p>
                  <ul className="space-y-3">
                    {plan.featureKeys.map((key) => (
                      <li key={key} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                        <span>{t(key)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    {t('compareSpecsHeading')}
                  </h3>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 px-4 py-4 text-slate-700 dark:text-slate-300 text-[13px] sm:text-sm leading-relaxed flex-1">
                    <p className="whitespace-pre-line">{t(`${slug}DetailsExtended`)}</p>
                  </div>
                </div>

                <div className="mt-6 pt-4">
                  <Link
                    href="/pricing"
                    className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold bg-[#2563eb] text-white hover:bg-[#1d4ed8] transition-colors"
                  >
                    {t('ctaChoose')}
                  </Link>
                  <Link
                    href="/signup?mode=trial"
                    className="block w-full text-center py-2 mt-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#2563eb] underline underline-offset-2"
                  >
                    {t('ctaTrial')}
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
