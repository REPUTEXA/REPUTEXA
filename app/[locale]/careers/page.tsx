'use client';

import { useLocale, useTranslations } from 'next-intl';
import { PublicPageShell } from '@/components/public-page-shell';
import { DepartmentContactForm } from '@/components/department-contact-form';
import {
  Brain,
  BarChart2,
  Code,
  TrendingUp,
  Globe,
  Shield,
  ArrowRight,
  MapPin,
  Clock,
  Zap,
  Heart,
  Laptop,
  GraduationCap,
  Coffee,
} from 'lucide-react';
import {
  getCareersPublicContent,
  type CareersBenefitIconKey,
  type CareersJobIconKey,
} from '@/lib/i18n/pages/careers-public-content';

const JOB_ICONS: Record<CareersJobIconKey, typeof Brain> = {
  brain: Brain,
  barChart2: BarChart2,
  code: Code,
  trendingUp: TrendingUp,
  globe: Globe,
  shield: Shield,
};

const BENEFIT_ICONS: Record<CareersBenefitIconKey, typeof Laptop> = {
  laptop: Laptop,
  zap: Zap,
  graduationCap: GraduationCap,
  heart: Heart,
  coffee: Coffee,
  trendingUp: TrendingUp,
};

/** Clés techniques du formulaire (routage API), hors copy utilisateur. */
const CAREERS_FORM_DEPARTMENT = 'careers' as const;
const CAREERS_RECRUIT_EMAIL = 'recrutement@reputexa.fr';

export default function CareersPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getCareersPublicContent(locale);

  return (
    <PublicPageShell title={t('careers.title')} subtitle={t('careers.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
        {c.metrics.map(({ value, label }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="font-display text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-3">{c.cultureTitle}</h2>
        <p className="text-gray-400 leading-relaxed max-w-3xl mb-4">{c.cultureP1}</p>
        <p className="text-gray-400 leading-relaxed max-w-3xl">{c.cultureP2}</p>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.openRolesTitle}</h2>
        <div className="space-y-4">
          {c.jobs.map(({ id, title, department, location, type, level, iconKey, description, tags }) => {
            const Icon = JOB_ICONS[iconKey];
            return (
              <div
                key={id}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/20">
                    <Icon className="w-6 h-6 text-[#2563eb]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-white group-hover:text-[#2563eb] transition-colors">
                        {title}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-3">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {location}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {type}
                      </span>
                      <span className="rounded-full bg-[#2563eb]/20 text-[#2563eb] px-2.5 py-0.5 font-medium">
                        {department}
                      </span>
                      <span className="text-gray-600">{level}</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-md bg-white/10 px-2.5 py-0.5 text-xs text-gray-400 font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href="#careers-form"
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563eb] text-white font-semibold text-sm hover:bg-[#1d4ed8] transition-colors whitespace-nowrap"
                  >
                    {c.applyCta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="font-display text-xl font-bold text-white mb-6">{c.benefitsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {c.benefits.map(({ iconKey, title, description }) => {
            const Icon = BENEFIT_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20 mb-3">
                  <Icon className="w-4 h-4 text-[#2563eb]" />
                </div>
                <h3 className="font-display font-semibold text-white mb-1.5 text-sm">{title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="careers-form" className="mt-10 mb-8">
        <h2 className="font-display text-xl font-bold text-white mb-2">{c.formTitle}</h2>
        <p className="text-sm text-gray-500 mb-6">{c.formIntro}</p>
        <DepartmentContactForm
          department={CAREERS_FORM_DEPARTMENT}
          recipientEmail={CAREERS_RECRUIT_EMAIL}
          heading={c.formHeading}
          description={c.formDescription}
          teamLabel={c.teamLabel}
          messagePlaceholder={c.messagePlaceholder}
          submitLabel={c.submitLabel}
          extraFields={c.extraFields}
          allowAttachments
          attachmentLabel={c.attachmentLabel}
        />
      </section>

      <p className="mt-8 text-xs text-gray-500 leading-relaxed max-w-2xl mx-auto text-center">
        <strong className="text-gray-400">{c.recruitmentNoticeTitle}</strong> {c.recruitmentNoticeBody}
      </p>
    </PublicPageShell>
  );
}
