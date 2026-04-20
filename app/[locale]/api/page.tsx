'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import {
  Shield,
  Zap,
  Terminal,
  CheckCircle,
  ArrowRight,
  Key,
  Smartphone,
  AlertTriangle,
  Lock,
  ShoppingCart,
} from 'lucide-react';
import { getApiPublicContent, type ApiSecurityRule } from '@/lib/i18n/pages/api-public-content';

const USE_CASE_ICONS = {
  shoppingCart: ShoppingCart,
  zap: Zap,
  smartphone: Smartphone,
} as const;

const SECURITY_ICONS = {
  lock: Lock,
  shield: Shield,
  alertTriangle: AlertTriangle,
  checkCircle: CheckCircle,
} as const;

function SecurityRuleRow({ rule }: { rule: ApiSecurityRule }) {
  const Icon = SECURITY_ICONS[rule.iconKey];
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <Icon className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-gray-400 leading-relaxed">{rule.text}</p>
    </div>
  );
}

export default function ApiPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getApiPublicContent(locale);
  const honestBodyHtml = c.honestBodyHtml.replace(
    /href="\/dashboard"/,
    `href="/${locale}/dashboard"`
  );

  return (
    <PublicPageShell title={t('api.title')} subtitle={t('api.subtitle')}>
      <div className="mb-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white mb-1 text-sm">{c.honestTitle}</p>
            <p
              className="text-sm text-gray-400 leading-relaxed [&_strong]:text-white [&_em]:text-gray-300"
              dangerouslySetInnerHTML={{ __html: honestBodyHtml }}
            />
          </div>
        </div>
      </div>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.sectionUseCases}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {c.useCases.map((uc) => {
            const Icon = USE_CASE_ICONS[uc.iconKey];
            return (
              <div key={uc.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563eb]/20">
                    <Icon className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${uc.badgeColor}`}>{uc.badge}</span>
                </div>
                <h3 className="font-display font-semibold text-white mb-2 text-sm">{uc.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{uc.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-[#2563eb]" />
          {c.sectionKeyTitle}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p
            className="text-sm text-gray-400 leading-relaxed mb-4 [&_code]:text-gray-300 [&_code]:font-mono [&_code]:text-xs [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded"
            dangerouslySetInnerHTML={{ __html: c.keyIntro }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {c.keySteps.map(({ step, label }) => (
              <div key={step} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563eb]/20 text-xs font-bold text-[#2563eb]">
                  {step}
                </span>
                <span className="text-sm text-gray-400">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">{c.keyFootnote}</p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-[#2563eb]" />
          {c.sectionEndpoint}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-white/5">
            <span className="rounded bg-blue-500/20 text-blue-400 px-2 py-0.5 text-xs font-bold">POST</span>
            <code className="text-xs text-gray-300 font-mono">{t('api.webhookPath')}</code>
          </div>
          <pre className="p-5 text-xs text-gray-300 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
            {c.endpointDoc}
          </pre>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#2563eb]" />
          {c.sectionSecurity}
        </h2>
        <div className="space-y-3">
          {c.securityRules.map((rule) => (
            <SecurityRuleRow key={rule.text} rule={rule} />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#2563eb]" />
          {c.sectionCodes}
        </h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {c.errorCodes.map(({ code, desc }, i) => (
            <div
              key={code}
              className={`flex items-center gap-4 px-5 py-3.5 ${i < c.errorCodes.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/5 transition-colors`}
            >
              <span
                className={`font-mono font-bold text-sm w-10 shrink-0 ${code === '200' ? 'text-emerald-400' : Number(code) >= 500 ? 'text-red-400' : 'text-amber-400'}`}
              >
                {code}
              </span>
              <span className="text-sm text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-display text-xl font-bold text-white mb-4">{c.zapierSectionTitle}</h2>
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10 bg-white/5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-gray-300">{c.zapierPanelLabel}</span>
          </div>
          <pre className="p-5 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">{c.zapierExample}</pre>
        </div>
      </section>

      <div className="rounded-2xl border border-[#2563eb]/30 bg-[#2563eb]/10 p-7 text-center">
        <h3 className="font-display text-xl font-bold text-white mb-2">{c.ctaTitle}</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-lg mx-auto">{c.ctaBody}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup?mode=trial"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2563eb] text-white font-semibold hover:bg-[#1d4ed8] transition-colors"
          >
            {c.ctaTrial}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/documentation"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
          >
            {c.ctaDoc}
          </Link>
        </div>
      </div>
    </PublicPageShell>
  );
}
