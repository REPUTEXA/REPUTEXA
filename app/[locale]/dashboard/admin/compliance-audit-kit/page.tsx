import type { Metadata } from 'next';
import type { AbstractIntlMessages } from 'next-intl';
import { createTranslator } from 'next-intl';
import { redirect } from 'next/navigation';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadSubscribedMerchantsForAudit } from '@/lib/admin/compliance-audit-subscribers';
import { Link } from '@/i18n/navigation';
import {
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  Shield,
} from 'lucide-react';
import { AdminSubpageHeader } from '@/components/admin/admin-subpage-header';
import { AdminAuditExportLinks } from '@/components/admin/admin-audit-export-links';
import { AuditKitPageGuideAccordion } from '@/components/admin/admin-dashboard-home-guides';
import { AdminOperatorChecklist } from '@/components/admin/admin-operator-checklist';
import { ComplianceKitDocHabitGuide } from '@/components/admin/compliance-kit-doc-habit-guide';
import { ComplianceMonthlyBundleClient } from '@/components/admin/compliance-monthly-bundle-client';

export const dynamic = 'force-dynamic';

async function kitTranslator(locale: string) {
  const messages = (await getMessages()) as AbstractIntlMessages;
  return createTranslator({ locale, messages, namespace: 'Dashboard.adminComplianceKit' });
}

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const tKit = await kitTranslator(locale);
  return {
    title: tKit('metaTitle'),
    description: tKit('metaDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function ComplianceAuditKitPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tKit = await kitTranslator(locale);
  const tChrome = await getTranslations({ locale, namespace: 'Dashboard.adminSubpageChrome' });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    redirect(`/${locale}/dashboard`);
  }

  const adminDb = createAdminClient();
  const auditMerchants = adminDb ? await loadSubscribedMerchantsForAudit(adminDb) : [];

  const kitLinks = [
    {
      href: '/docs/compliance-audit-kit/README.md',
      label: tKit('readmeLabel'),
      hint: tKit('readmeHint'),
      freq: tKit('kitFileFreqReadme'),
      icon: FileText,
    },
    {
      href: '/docs/compliance-audit-kit/GUIDE-COMPLET-VERIFICATION-CONFORMITE.md',
      label: tKit('guideCompletLabel'),
      hint: tKit('guideCompletHint'),
      freq: tKit('kitFileFreqGuide'),
      icon: ClipboardList,
    },
    {
      href: '/docs/compliance-audit-kit/FORTRESSE-QUATRE-PILIERS.md',
      label: tKit('fortresseLabel'),
      hint: tKit('fortresseHint'),
      freq: tKit('kitFileFreqFortresse'),
      icon: Shield,
    },
    {
      href: '/docs/compliance-audit-kit/liste-sous-traitants.csv',
      label: tKit('csvLabel'),
      hint: tKit('csvHint'),
      freq: tKit('kitFileFreqCsv'),
      icon: FileSpreadsheet,
    },
    {
      href: '/docs/registre-rgpd-reputexa.html',
      label: tKit('registreLabel'),
      hint: tKit('registreHint'),
      freq: tKit('kitFileFreqRegistreHtml'),
      icon: FolderOpen,
    },
    {
      href: '/docs/registre-traitements-art30-reputexa.csv',
      label: tKit('registreCsvLabel'),
      hint: tKit('registreCsvHint'),
      freq: tKit('kitFileFreqRegistreCsv'),
      icon: FileSpreadsheet,
    },
  ] as const;

  const legalLinks = [
    { href: '/legal/confidentialite', label: tKit('privacy') },
    { href: '/legal/cgu', label: tKit('terms') },
    { href: '/legal/mentions-legales', label: tKit('mentions') },
  ] as const;

  const quickNavItems = [
    ['#kit-rhythm', tKit('navCadence')],
    ['#dossier-mensuel-pdf', tKit('navMonthlyBundle')],
    ['#guide-habitudes', tKit('navDocHabits')],
    ['#fiche-operateur', tKit('sectionOperatorChecklist')],
    ['#fiche-tracabilite', tKit('sectionOperatorTrace')],
    ['#kit-fichiers', tKit('sectionKitFiles')],
    ['#exports-audit', tKit('sectionAuditExports')],
    ['#pages-legales', tKit('sectionLegal')],
    ['#donnees-sensibles', tKit('sectionSensitive')],
  ] as const;

  return (
    <div className="min-h-full bg-zinc-950 text-white">
      <AdminSubpageHeader
        narrow
        title={tKit('title')}
        badge={tChrome('blackBoxBadge')}
        subtitle={tKit('subtitle')}
        icon={<Shield className="h-5 w-5 text-emerald-400/90" strokeWidth={1.75} />}
        backLabel={tKit('backToAdmin')}
      />

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <AuditKitPageGuideAccordion />

        <section
          id="kit-rhythm"
          className="scroll-mt-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-4 sm:px-5 space-y-2.5"
          aria-labelledby="kit-rhythm-title"
        >
          <h2 id="kit-rhythm-title" className="text-xs font-semibold text-emerald-200/90 uppercase tracking-widest">
            {tKit('kitPageRhythmTitle')}
          </h2>
          <ul className="text-[12px] text-zinc-400 leading-relaxed space-y-2 list-none pl-0">
            <li className="flex gap-2">
              <span className="text-emerald-500/80 shrink-0 font-mono text-[10px] pt-0.5">J</span>
              <span>{tKit('kitPageRhythmDaily')}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500/80 shrink-0 font-mono text-[10px] pt-0.5">S</span>
              <span>{tKit('kitPageRhythmWeekly')}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-500/80 shrink-0 font-mono text-[10px] pt-0.5">M</span>
              <span>{tKit('kitPageRhythmMonthly')}</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500/80 shrink-0 font-mono text-[10px] pt-0.5">!</span>
              <span>{tKit('kitPageRhythmEvent')}</span>
            </li>
          </ul>
        </section>

        <ComplianceMonthlyBundleClient
          title={tKit('bundlePdfTitle')}
          intro={tKit('bundlePdfIntro')}
          monthLabel={tKit('bundlePdfMonthLabel')}
          signedByLabel={tKit('bundlePdfSignedByLabel')}
          signedByPlaceholder={tKit('bundlePdfSignedByPlaceholder')}
          downloadLabel={tKit('bundlePdfDownload')}
          hint={tKit('bundlePdfHint')}
          archivesTitle={tKit('bundleArchivesTitle')}
          archivesEmpty={tKit('bundleArchivesEmpty')}
          archivesLoadError={tKit('archivesLoadError')}
          sourceCron={tKit('bundleSourceCron')}
          sourceManual={tKit('bundleSourceManual')}
          archiveNowLabel={tKit('bundleArchiveNowLabel')}
          archiveNowBusy={tKit('bundleArchiveNowBusy')}
          refreshLabel={tKit('bundleRefreshLabel')}
          cronAutoHint={tKit('bundleCronAutoHint')}
          archiveDone={tKit('bundleArchiveDone')}
        />

        <nav
          aria-label={tKit('navQuickAccess')}
          className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5 touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap"
        >
          {quickNavItems.map(([hash, label]) => (
            <a
              key={hash}
              href={hash}
              className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <ComplianceKitDocHabitGuide />

        <AdminOperatorChecklist />

        <section id="kit-fichiers" className="scroll-mt-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            {tKit('sectionKitFiles')}
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed mb-4">{tKit('kitFilesCadenceIntro')}</p>
          <ul className="rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
            {kitLinks.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                      {item.label}
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    </span>
                    <p className="text-[11px] text-emerald-400/85 font-medium leading-snug mt-1.5">{item.freq}</p>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{item.hint}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="exports-audit" className="scroll-mt-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            {tKit('sectionAuditExports')}
          </h2>
          <p className="text-[11px] text-emerald-400/85 font-medium leading-snug mb-2">{tKit('sectionAuditExportsCadence')}</p>
          <p className="text-xs text-zinc-500 leading-relaxed mb-4">{tKit('sectionAuditExportsIntro')}</p>
          <AdminAuditExportLinks
            merchants={auditMerchants}
            labels={{
              merchantFilterLabel: tKit('merchantFilterLabel'),
              merchantFilterAll: tKit('merchantFilterAll'),
              merchantFilterHint: tKit('merchantFilterHint'),
              merchantSearchPlaceholder: tKit('merchantSearchPlaceholder'),
              merchantSearchPrompt: tKit('merchantSearchPrompt'),
              merchantFilterEmpty: tKit('merchantFilterEmpty'),
              includeMessageBodiesLabel: tKit('includeMessageBodiesLabel'),
              includeMessageBodiesHint: tKit('includeMessageBodiesHint'),
              auditJsonLabel: tKit('auditJsonLabel'),
              auditJsonCadence: tKit('auditJsonCadence'),
              auditJsonHint: tKit('auditJsonHint'),
              auditCsvQueueLabel: tKit('auditCsvQueueLabel'),
              auditCsvQueueCadence: tKit('auditCsvQueueCadence'),
              auditCsvQueueHint: tKit('auditCsvQueueHint'),
              auditCsvConsentLabel: tKit('auditCsvConsentLabel'),
              auditCsvConsentCadence: tKit('auditCsvConsentCadence'),
              auditCsvConsentHint: tKit('auditCsvConsentHint'),
            }}
          />
        </section>

        <section id="pages-legales" className="scroll-mt-6">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            {tKit('sectionLegal')}
          </h2>
          <p className="text-[11px] text-emerald-400/85 font-medium leading-snug mb-4">{tKit('sectionLegalCadence')}</p>
          <ul className="rounded-2xl border border-zinc-800/80 divide-y divide-zinc-800/60 overflow-hidden">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/40 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-zinc-400" />
                  </div>
                  <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                    {item.label}
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="donnees-sensibles"
          className="scroll-mt-6 mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4"
        >
          <h2 className="text-xs font-semibold text-amber-200/90 uppercase tracking-widest mb-2">
            {tKit('sectionSensitive')}
          </h2>
          <p className="text-[11px] text-amber-200/75 font-medium leading-snug mb-2">{tKit('sectionSensitiveCadence')}</p>
          <p className="text-xs text-zinc-400 leading-relaxed">{tKit('emplacementsHint')}</p>
        </section>

        <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-zinc-800/60 pt-6">
          {tKit('disclaimer')}
        </p>
      </div>
    </div>
  );
}
