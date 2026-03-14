'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/logo';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MONTHLY_EUR: Record<string, number> = { vision: 59, pulse: 97, zenith: 157 };
const MONTHLY_USD: Record<string, number> = { vision: 65, pulse: 107, zenith: 175 };
const ANNUAL_MULTIPLIER = 0.8;

const PLAN_TO_STRIPE: Record<string, 'starter' | 'manager' | 'dominator'> = {
  vision: 'starter',
  pulse: 'manager',
  zenith: 'dominator',
};

export default function PricingPage() {
  const t = useTranslations('PricingPage');
  const locale = useLocale();
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const useUsd = locale === 'en';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const formatPrice = (planKey: string) => {
    const base = useUsd ? MONTHLY_USD[planKey] ?? 0 : MONTHLY_EUR[planKey] ?? 0;
    const amount = annual ? Math.round(base * 12 * ANNUAL_MULTIPLIER) : base;
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
      style: 'currency',
      currency: useUsd ? 'USD' : 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const suffix = annual ? t('perYear') : t('perMonth');

  const handleSubscribe = (planKey: string) => {
    if (!session) {
      router.push(`/${locale}/signup?mode=checkout&plan=${planKey}`);
      return;
    }
    handleCheckout(planKey);
  };

  const handleCheckout = async (planKey: string) => {
    if (!session) return;
    setCheckoutLoading(planKey);
    try {
      const params = new URLSearchParams({
        locale,
        planType: PLAN_TO_STRIPE[planKey] ?? 'manager',
        planSlug: planKey,
      });
      if (annual) params.set('skipTrial', '1');
      const res = await fetch(`/api/stripe/create-checkout?${params}`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      if (data.url) window.location.href = data.url;
      else throw new Error('URL de paiement non reçue');
    } catch (err) {
      console.error('[pricing] checkout:', err);
      toast.error(err instanceof Error ? err.message : t('checkoutError'));
      setCheckoutLoading(null);
    }
  };

  const logoHref = session ? '/dashboard' : '/';
  const backLinkVisible = session;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href={logoHref}
            className="flex items-center gap-2 text-slate-800 dark:text-slate-100"
            aria-label="REPUTEXA"
          >
            <Logo />
            <span className="font-display font-bold text-lg">REPUTEXA</span>
          </Link>
          {backLinkVisible && (
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-medium"
            >
              {t('backToDashboard')}
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50">
            {t('headline')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            {t('subtitle')}
          </p>
        </div>

        {/* Toggle Monthly / Annual */}
        <div className="flex justify-center items-center gap-3 mb-12">
          <span className={`text-sm font-medium transition-colors ${!annual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {t('monthly')}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual((a) => !a)}
            className={`relative w-14 h-7 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:ring-offset-2 ${annual ? 'bg-[#2563eb]' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${annual ? 'left-8' : 'left-1'}`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${annual ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
            {t('annual')}
          </span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            {t('annualBadge')}
          </span>
        </div>

        {/* 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vision */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col">
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100">
              {t('visionTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('visionDesc')}
            </p>
            <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatPrice('vision')}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{suffix}</span>
            </p>
            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('visionFeature1')}
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('visionFeature2')}
              </li>
            </ul>
            <PlanButton
              planKey="vision"
              loading={checkoutLoading === 'vision'}
              sessionLoading={sessionLoading}
              onSubscribe={() => handleSubscribe('vision')}
              trialHref="/signup?mode=trial"
              t={t}
            />
          </div>

          {/* Pulse */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-6 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-600 dark:bg-slate-500 text-white text-xs font-bold">
              {t('pulseBadge')}
            </span>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 mt-1">
              {t('pulseTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('pulseDesc')}
            </p>
            <p className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatPrice('pulse')}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{suffix}</span>
            </p>
            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('pulseFeature1')}
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('pulseFeature2')}
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('pulseFeature3')}
              </li>
            </ul>
            <PlanButton
              planKey="pulse"
              loading={checkoutLoading === 'pulse'}
              sessionLoading={sessionLoading}
              onSubscribe={() => handleSubscribe('pulse')}
              trialHref="/signup?mode=trial"
              t={t}
              primary
            />
          </div>

          {/* Zenith - Mise en avant */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#2563eb] shadow-lg shadow-[#2563eb]/15 p-6 flex flex-col relative ring-2 ring-[#2563eb]/20">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#2563eb] text-white text-xs font-bold">
              {t('zenithBadge')}
            </span>
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 mt-1">
              {t('zenithTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('zenithDesc')}
            </p>
            <p className="mt-4 text-2xl font-bold text-[#2563eb]">
              {formatPrice('zenith')}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">{suffix}</span>
            </p>
            <ul className="mt-6 space-y-3 flex-1">
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('zenithFeature1')}
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('zenithFeature2')}
              </li>
              <li className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                {t('zenithFeature3')}
              </li>
            </ul>
            <PlanButton
              planKey="zenith"
              loading={checkoutLoading === 'zenith'}
              sessionLoading={sessionLoading}
              onSubscribe={() => handleSubscribe('zenith')}
              trialHref="/signup?mode=trial"
              t={t}
              primary
            />
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          {t('stripeReassurance')}
        </p>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
          {t('trialMention')}
        </p>
      </main>
    </div>
  );
}

function PlanButton({
  planKey,
  loading,
  sessionLoading,
  onSubscribe,
  trialHref,
  t,
  primary,
}: {
  planKey: string;
  loading: boolean;
  sessionLoading: boolean;
  onSubscribe: () => void;
  trialHref: string;
  t: (k: string) => string;
  primary?: boolean;
}) {
  const baseClass = 'mt-6 block w-full py-3 rounded-xl text-center font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2';
  const primaryClass = 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]';
  const secondaryClass = 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200';

  return (
    <div className="space-y-2" data-plan={planKey}>
      <button
        type="button"
        onClick={onSubscribe}
        disabled={sessionLoading || loading}
        className={`${baseClass} ${primary ? primaryClass : secondaryClass}`}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : null}
        {t('ctaSubscribe')}
      </button>
      <Link
        href={trialHref}
        className="block w-full py-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-[#2563eb] dark:hover:text-[#2563eb] underline underline-offset-2 hover:no-underline transition-colors"
      >
        {t('ctaTrial')}
      </Link>
    </div>
  );
}
