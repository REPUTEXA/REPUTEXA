'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Key,
  Shield,
  Zap,
  BookOpen,
  Terminal,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Settings,
  Globe,
  UserPlus,
  Mail,
  Webhook,
} from 'lucide-react';

type OnboardingStep = {
  number: string;
  title: string;
  description: string;
  detail: string;
};

type FlowStep = { step: string; detail: string };

type PlatformRow = { name: string; status: string; available: string };

type KeyCard = { label: string; path: string; plan: string };

const ONBOARDING_ICONS = [UserPlus, Mail, Globe, Settings, Smartphone] as const;
const KEYS_CARD_COLORS = ['text-violet-400', 'text-blue-400', 'text-emerald-400'] as const;

export default function DocumentationPage() {
  const tShell = useTranslations('PublicPages');
  const t = useTranslations('DocumentationPage');
  const onboardingSteps = t.raw('onboardingSteps') as OnboardingStep[];
  const whatsappFlow = t.raw('whatsappFlow') as FlowStep[];
  const platformsRows = t.raw('platformsRows') as PlatformRow[];
  const keysCards = t.raw('keysCards') as KeyCard[];
  const practices = t.raw('practices') as string[];

  return (
    <PublicPageShell title={tShell('documentation.title')} subtitle={tShell('documentation.subtitle')}>
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Zap className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{t('onboardingTitle')}</h2>
          <span className="ml-2 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-medium text-emerald-400">
            {t('onboardingBadge')}
          </span>
        </div>
        <div className="space-y-4">
          {onboardingSteps.map((step, idx) => {
            const Icon = ONBOARDING_ICONS[idx] ?? UserPlus;
            return (
              <div
                key={step.number}
                className="relative flex gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/20">
                  <Icon className="w-5 h-5 text-[#2563eb]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-xs text-gray-600">{step.number}</span>
                    <h3 className="font-display font-semibold text-white">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-2">{step.description}</p>
                  <p className="text-xs text-gray-600 leading-relaxed border-l-2 border-white/10 pl-3">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Smartphone className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{t('whatsappTitle')}</h2>
        </div>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">{t('whatsappIntro')}</p>
        <div className="space-y-3">
          {whatsappFlow.map((row, i) => (
            <div
              key={`flow-${i}`}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/20 mt-0.5">
                <span className="text-xs font-bold text-[#2563eb]">{i + 1}</span>
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-0.5">{row.step}</p>
                <p className="text-xs text-gray-400 leading-relaxed">{row.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Globe className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{t('platformsTitle')}</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3 border-b border-white/10">
            <span>{t('colPlatform')}</span>
            <span>{t('colProtocol')}</span>
            <span>{t('colAvailability')}</span>
          </div>
          {platformsRows.map((row, i) => (
            <div
              key={row.name}
              className={`grid grid-cols-3 px-5 py-4 hover:bg-white/5 transition-colors ${i < platformsRows.length - 1 ? 'border-b border-white/5' : ''}`}
            >
              <span className="text-sm font-medium text-white">{row.name}</span>
              <span className="text-xs text-gray-400 self-center">{row.status}</span>
              <span className="text-xs self-center">
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 font-medium">
                  {row.available}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">{t('platformsFootnote')}</p>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Webhook className="w-5 h-5 text-[#2563eb]" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">{t('posTitle')}</h2>
            <span className="text-xs text-violet-400 font-medium">{t('posBadge')}</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">{t('posIntro')}</p>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-white/5">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-300">{t('posWebhookLabel')}</span>
          </div>
          <pre className="p-5 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {t('posCodeBlock')}
          </pre>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">{t('posKeyNote')}</p>
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Key className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{t('keysTitle')}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {keysCards.map((card, i) => (
            <div key={card.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="font-semibold text-white text-xs mb-1.5">{card.label}</p>
              <p className="text-xs text-gray-500 font-mono mb-2">{card.path}</p>
              <span className={`text-xs font-medium ${KEYS_CARD_COLORS[i] ?? 'text-gray-400'}`}>
                {card.plan}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Shield className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{t('practicesTitle')}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {practices.map((tip, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-400 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-[#2563eb]/30 bg-[#2563eb]/10 p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2563eb]/20">
            <BookOpen className="w-6 h-6 text-[#2563eb]" />
          </div>
        </div>
        <h3 className="font-display text-xl font-bold text-white mb-2">{t('ctaTitle')}</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto">{t('ctaBody')}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup?mode=trial"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            {t('ctaTrial')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
          >
            {t('ctaHelp')}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
