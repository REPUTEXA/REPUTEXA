'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { PublicPageShell } from '@/components/public-page-shell';
import { DepartmentContactForm } from '@/components/department-contact-form';
import {
  Lock,
  Shield,
  Server,
  Eye,
  CheckCircle,
  Globe,
  RefreshCw,
  Database,
  UserCheck,
  FileText,
  Bot,
} from 'lucide-react';
import { RegistrePreview, RegistreSectionHeader } from '@/components/security/registre-preview';
import {
  getSecurityPublicContent,
  type SecurityEncryptionIconKey,
  type SecurityRgpdIconKey,
} from '@/lib/i18n/pages/security-public-content';

/** Clés API formulaire contact (route e-mail). */
const DEPARTMENT_CONTACT_LEGAL = 'legal' as const;
const LEGAL_ROUTING_EMAIL = 'legal@reputexa.fr';

/** Prop polymorphique RegistreSectionHeader (API), hors copy. */
const REGISTRE_SECTION_HEADER_AS = 'h3' as const;

const ENCRYPTION_ICONS: Record<SecurityEncryptionIconKey, typeof Lock> = {
  lock: Lock,
  database: Database,
  server: Server,
  bot: Bot,
};

const RGPD_ICONS: Record<SecurityRgpdIconKey, typeof UserCheck> = {
  userCheck: UserCheck,
  fileText: FileText,
  globe: Globe,
  refreshCw: RefreshCw,
};

export default function SecurityPage() {
  const locale = useLocale();
  const t = useTranslations('PublicPages');
  const c = getSecurityPublicContent(locale);

  return (
    <PublicPageShell title={t('security.title')} subtitle={t('security.subtitle')}>
      <div className="flex flex-wrap justify-center gap-3 mb-10">
        {c.stackBadges.map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-medium text-gray-300"
          >
            {badge}
          </span>
        ))}
      </div>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Shield className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{c.registreSectionTitle}</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6 max-w-3xl leading-relaxed">{c.registreIntro}</p>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <RegistreSectionHeader as={REGISTRE_SECTION_HEADER_AS} className="!mb-5" />
          <RegistrePreview />
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Lock className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{c.encryptionSectionTitle}</h2>
        </div>
        <div className="space-y-4">
          {c.encryptionLayers.map(({ iconKey, title, badge, badgeColor, description, details }) => {
            const Icon = ENCRYPTION_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2563eb]/20">
                    <Icon className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-display font-semibold text-white">{title}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeColor}`}>{badge}</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed mb-4">{description}</p>
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {details.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Eye className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{c.vendorsTitle}</h2>
        </div>
        <p className="text-sm text-gray-400 mb-5 leading-relaxed">{c.vendorsIntro}</p>
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          {c.trustStack.map(({ name, role, cert }, i) => (
            <div
              key={name}
              className={`flex items-center gap-4 px-6 py-4 ${i < c.trustStack.length - 1 ? 'border-b border-white/5' : ''} hover:bg-white/5 transition-colors`}
            >
              <span className="font-semibold text-white w-28 shrink-0 text-sm">{name}</span>
              <span className="text-sm text-gray-400 flex-1">{role}</span>
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 text-xs font-medium shrink-0">
                {cert}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">{c.vendorsFootnote}</p>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Server className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{c.controlsTitle}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {c.controls.map((control, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-400 leading-relaxed">{control}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2563eb]/20">
            <Shield className="w-5 h-5 text-[#2563eb]" />
          </div>
          <h2 className="font-display text-xl font-bold text-white">{c.rgpdSectionTitle}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {c.rgpdItems.map(({ iconKey, title, content }) => {
            const Icon = RGPD_ICONS[iconKey];
            return (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563eb]/20">
                    <Icon className="w-4 h-4 text-[#2563eb]" />
                  </div>
                  <h3 className="font-display font-semibold text-white text-sm">{title}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{content}</p>
              </div>
            );
          })}
        </div>
      </section>

      <DepartmentContactForm
        department={DEPARTMENT_CONTACT_LEGAL}
        recipientEmail={LEGAL_ROUTING_EMAIL}
        heading={c.formHeading}
        description={c.formDescription}
        teamLabel={c.teamLabel}
        messagePlaceholder={c.messagePlaceholder}
        submitLabel={c.submitLabel}
        extraFields={c.legalExtraFields}
      />

      <div className="mt-5 flex justify-center">
        <Link
          href="/legal/confidentialite"
          className="text-sm text-gray-500 hover:text-[#2563eb] transition-colors underline-offset-2 hover:underline"
        >
          {c.privacyLink}
        </Link>
      </div>
    </PublicPageShell>
  );
}
