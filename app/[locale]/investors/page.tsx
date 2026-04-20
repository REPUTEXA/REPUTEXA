'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PublicPageShell } from '@/components/public-page-shell';
import { DepartmentContactForm } from '@/components/department-contact-form';
import { Globe, Shield, Brain, Target, CheckCircle, Lock, Layers } from 'lucide-react';
import {
  getInvestorsPublicContent,
  type InvestorsDiffIconKey,
} from '@/lib/i18n/pages/investors-public-content';

const DIFF_ICONS: Record<InvestorsDiffIconKey, typeof Brain> = {
  brain: Brain,
  shield: Shield,
  layers: Layers,
  globe: Globe,
};

const DEPARTMENT_CONTACT_INVESTORS = 'investors' as const;
/** Alias d’affichage — aligné sur `targets/settings.json` → interface.department_emails.investors */
const INVESTORS_ROUTING_EMAIL = 'investors@reputexa.fr';

export default function InvestorsPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getInvestorsPublicContent(locale);

  return (
    <PublicPageShell title={t('investors.title')} subtitle={t('investors.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        {c.kpis.map(({ value, label, trend }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="font-display text-2xl sm:text-3xl font-bold text-white mb-0.5">{value}</p>
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className="text-xs text-emerald-400 font-medium">{trend}</p>
          </div>
        ))}
      </div>

      <section className="mb-16">
        <div className="rounded-2xl border border-[#2563eb]/30 bg-gradient-to-br from-[#2563eb]/10 to-transparent p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563eb]/20">
              <Target className="w-5 h-5 text-[#2563eb]" />
            </div>
            <h2 className="font-display text-xl font-bold text-white">{c.visionTitle}</h2>
          </div>
          <p className="text-lg text-gray-200 leading-relaxed font-light mb-4">{c.visionP1}</p>
          <p className="text-sm text-gray-400 leading-relaxed">{c.visionP2}</p>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.marketTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {c.market.map(({ value, label, desc }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#2563eb] mb-1">{value}</p>
              <p className="font-semibold text-white text-sm mb-1.5">{label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-gray-400 leading-relaxed">
            <strong className="text-white">{c.marketMacroLabel}</strong> {c.marketMacroBody}
          </p>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.diffTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {c.differentiators.map(({ iconKey, title, description }) => {
            const Icon = DIFF_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
                    <Icon className="w-4 h-4 text-[#2563eb]" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">{title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.unitTitle}</h2>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {c.unitEconomics.map(({ metric, value, note }, i) => (
            <div
              key={metric}
              className={`flex items-center gap-4 px-6 py-4 ${i < c.unitEconomics.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/5 transition-colors`}
            >
              <span className="text-sm text-gray-400 w-40 shrink-0">{metric}</span>
              <span className="font-mono font-bold text-white text-lg w-24 shrink-0">{value}</span>
              <span className="text-xs text-gray-500">{note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.roadmapTitle}</h2>
        <div className="space-y-4">
          {c.roadmap.map(({ period, milestones }) => (
            <div key={period} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-[#2563eb]/20 px-3 py-1">
                  <span className="text-sm font-bold text-[#2563eb]">{period}</span>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {milestones.map((m) => (
                  <li key={m} className="flex items-start gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.trustTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {c.trustSignals.map((signal) => (
            <div key={signal} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-400 leading-relaxed">{signal}</p>
            </div>
          ))}
        </div>
      </section>

      <DepartmentContactForm
        department={DEPARTMENT_CONTACT_INVESTORS}
        recipientEmail={INVESTORS_ROUTING_EMAIL}
        heading={c.formHeading}
        description={c.formDescription}
        teamLabel={c.teamLabel}
        messagePlaceholder={c.messagePlaceholder}
        submitLabel={c.submitLabel}
        extraFields={c.extraFields}
      />
    </PublicPageShell>
  );
}
